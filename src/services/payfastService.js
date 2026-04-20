// ============================================================
// services/payfastService.js — DEFINITIVE FIXED VERSION
// ============================================================
//
// WHAT WAS CAUSING THE 400 BAD REQUEST:
//
// 1. WRONG FIELD ORDER IN SIGNATURE
//    PayFast requires fields in their DEFINED order (merchant_id first,
//    merchant_key second, then URLs, then buyer info, then payment info).
//    Sorting alphabetically produces the wrong order → mismatched hash.
//    Source: payfast.io/faq — "most-likely cause is if you generated the
//    MD5 hashed string with the variables in the wrong order"
//
// 2. LOWERCASE URL ENCODING
//    encodeURIComponent() produces lowercase hex (%2f, %3a) but PayFast
//    requires UPPERCASE hex (%2F, %3A).
//    Source: PayFast FAQ — "URLencoding must be in uppercase"
//
// 3. MISSING VALUE TRIMMING
//    Values must be trimmed of whitespace before encoding.
//    Source: PayFast FAQ — "parameter string has not been trimmed"
//
// 4. qs package was used but is NOT in package.json.
//    Replaced with Node's built-in URLSearchParams.
// ============================================================

const crypto = require('crypto');
const axios = require('axios');
const { User, Payment } = require('../models/index');
const mongoose = require('mongoose');
const { sendNotification, logActivity } = require('../utils/helpers');

// ================= CONFIG =================
const PAYFAST_CONFIG = {
    sandbox: {
        paymentUrl: 'https://sandbox.payfast.co.za/eng/process',
        validateUrl: 'https://sandbox.payfast.co.za/eng/query/validate',
        merchantId: process.env.PAYFAST_MERCHANT_ID,
        merchantKey: process.env.PAYFAST_MERCHANT_KEY,
        passPhrase: process.env.PAYFAST_PASSPHRASE,
    },
    production: {
        paymentUrl: 'https://www.payfast.co.za/eng/process',
        validateUrl: 'https://www.payfast.co.za/eng/query/validate',
        merchantId: process.env.PAYFAST_MERCHANT_ID,
        merchantKey: process.env.PAYFAST_MERCHANT_KEY,
        passPhrase: process.env.PAYFAST_PASSPHRASE,
    },
};

const ENV = process.env.NODE_ENV === 'production' ? 'production' : 'sandbox';
const CONFIG = PAYFAST_CONFIG[ENV];

// ================= PAYFAST FIELD ORDER =================
// PayFast validates fields in this EXACT order. Deviation = signature mismatch.
// Source: https://developers.payfast.co.za/documentation/ Step 2
const PAYFAST_FIELD_ORDER = [
    'merchant_id',
    'merchant_key',
    'return_url',
    'cancel_url',
    'notify_url',
    'name_first',
    'name_last',
    'email_address',
    'cell_number',
    'm_payment_id',
    'amount',
    'item_name',
    'item_description',
    'custom_int1', 'custom_int2', 'custom_int3', 'custom_int4', 'custom_int5',
    'custom_str1', 'custom_str2', 'custom_str3', 'custom_str4', 'custom_str5',
    'email_confirmation',
    'confirmation_address',
    'payment_method',
    'subscription_type',
    'billing_date',
    'recurring_amount',
    'frequency',
    'cycles',
];

// ================= URL ENCODE (PayFast-compliant) =================
// PayFast requires UPPERCASE hex in percent-encoding (%2F not %2f).
// encodeURIComponent() is lowercase-only in JS, so we uppercase the hex digits.
function pfEncode(value) {
    return encodeURIComponent(String(value).trim())
        .replace(/%[0-9a-f]{2}/g, (match) => match.toUpperCase())
        .replace(/%20/g, '+'); // spaces as + (form-urlencoded convention)
}

// ================= SIGNATURE =================
function generateSignature(data) {
    const passPhrase = (CONFIG.passPhrase || '').trim();

    // Build the signature string in PayFast's required field order.
    // Skip any field that is empty or not present — empty fields break the hash.
    const parts = [];

    PAYFAST_FIELD_ORDER.forEach((key) => {
        if (key === 'signature') return;
        const value = data[key];
        if (value === null || value === undefined || String(value).trim() === '') return;
        parts.push(`${key}=${pfEncode(value)}`);
    });

    // Append any extra fields not in the known order (e.g. pf_payment_id in ITN)
    Object.keys(data).forEach((key) => {
        if (PAYFAST_FIELD_ORDER.includes(key) || key === 'signature') return;
        const value = data[key];
        if (value === null || value === undefined || String(value).trim() === '') return;
        parts.push(`${key}=${pfEncode(value)}`);
    });

    let signatureString = parts.join('&');

    if (passPhrase) {
        signatureString += `&passphrase=${pfEncode(passPhrase)}`;
    }

    const signature = crypto.createHash('md5').update(signatureString).digest('hex');

    console.log('\n🔐 SIGNATURE:');
    console.log('   String:', signatureString.replace(/passphrase=[^&]+/, 'passphrase=***'));
    console.log(`   Result: ${signature}\n`);

    return signature;
}

// ================= CREATE PAYMENT =================
exports.createWalletTopUp = async (userId, amount, return_url) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        if (!amount || amount < 10 || amount > 100000) {
            throw new Error('Invalid amount');
        }

        const user = await User.findById(userId).session(session);
        if (!user) throw new Error('User not found');

        const payment = new Payment({
            payer: userId,
            payee: userId,
            grossAmount: amount,
            netAmount: amount,
            platformFee: 0,
            status: 'pending',
            type: 'wallet_topup',
            method: 'payfast',
            description: `Wallet top-up: R${amount}`,
        });

        const savedPayment = await payment.save({ session });

        // Build form data. Field order matches PAYFAST_FIELD_ORDER above.
        const payfastData = {
            merchant_id: String(CONFIG.merchantId).trim(),
            merchant_key: String(CONFIG.merchantKey).trim(),
            return_url: (
                return_url ||
                `${process.env.FRONTEND_URL || 'http://localhost:3000'}/wallet/topup/success`
            ).trim(),
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/wallet/topup/cancel`,
            // MUST be publicly reachable. For local dev run:
            //   npx ngrok http 5000
            // then set PAYFAST_NOTIFY_URL=https://xxxx.ngrok.io in .env
            notify_url: (
                process.env.PAYFAST_NOTIFY_URL ||
                `${process.env.SERVER_URL || 'http://localhost:5000'}/api/payments/payfast/callback`
            ).trim(),
            name_first: String(user.firstName || 'User').trim(),
            name_last: String(user.lastName || 'Account').trim(),
            email_address: String(user.email).trim(),
            m_payment_id: String(savedPayment._id),
            amount: parseFloat(amount).toFixed(2), // "500.00" — no extra whitespace
            item_name: 'Wallet Top-up',
            item_description: `Top-up R${amount}`,
            custom_str1: `WALLET_TOPUP|${savedPayment._id}`,
        };

        // Only add cell_number if non-empty — blank optional fields break the signature
        if (user.phone && String(user.phone).trim()) {
            payfastData.cell_number = String(user.phone).trim();
        }

        payfastData.signature = generateSignature(payfastData);

        console.log('📦 PAYFAST FORM DATA:');
        Object.keys(payfastData).forEach((key) => {
            const v = String(payfastData[key]);
            console.log(`   ${key}: ${v.substring(0, 70)}${v.length > 70 ? '...' : ''}`);
        });

        await session.commitTransaction();

        return {
            success: true,
            paymentId: savedPayment._id,
            paymentUrl: CONFIG.paymentUrl,
            data: payfastData,
        };
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
};

// ================= VERIFY TRANSACTION =================
exports.verifyPayfastTransaction = async (paymentId) => {
    const payment = await Payment.findById(paymentId);
    if (!payment) throw new Error('Payment not found');

    const verifyData = {
        merchant_id: String(CONFIG.merchantId).trim(),
        merchant_key: String(CONFIG.merchantKey).trim(),
        m_payment_id: String(paymentId),
    };
    verifyData.signature = generateSignature(verifyData);

    const response = await axios.post(
        CONFIG.validateUrl,
        new URLSearchParams(verifyData).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const isValid = response.data === 'VALID';
    console.log(`${isValid ? '✅' : '❌'} PayFast validation: ${response.data}`);
    return { success: isValid, data: response.data };
};

// ================= PROCESS CALLBACK (ITN) =================
exports.processPayfastCallback = async (callbackData) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const paymentId = callbackData.m_payment_id;
        const payment = await Payment.findById(paymentId).session(session);
        if (!payment) throw new Error('Payment not found');

        // 1. Verify signature PayFast sent us
        const receivedSignature = callbackData.signature;
        const dataToVerify = { ...callbackData };
        delete dataToVerify.signature;

        const expectedSignature = generateSignature(dataToVerify);

        console.log(`🔐 ITN SIGNATURE CHECK:`);
        console.log(`   Received: ${receivedSignature}`);
        console.log(`   Expected: ${expectedSignature}`);

        if (receivedSignature !== expectedSignature) {
            throw new Error('Invalid ITN signature');
        }
        console.log('   ✅ Signature valid\n');

        // 2. Validate with PayFast — send ONLY required fields, NOT the signature
        const validationPayload = {
            merchant_id: callbackData.merchant_id || CONFIG.merchantId,
            merchant_key: CONFIG.merchantKey,
            m_payment_id: callbackData.m_payment_id,
            pf_payment_id: callbackData.pf_payment_id,
            payment_status: callbackData.payment_status,
            amount_gross: callbackData.amount_gross,
        };

        const verifyResponse = await axios.post(
            CONFIG.validateUrl,
            new URLSearchParams(validationPayload).toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        if (verifyResponse.data !== 'VALID') {
            throw new Error(`PayFast ITN validation failed: ${verifyResponse.data}`);
        }

        const status = callbackData.payment_status;

        if (status === 'COMPLETE') {
            payment.status = 'released';
            payment.releasedAt = new Date();
            await payment.save({ session });

            console.log(`💰 UPDATING WALLET: User ${payment.payer}, Amount R${payment.grossAmount}`);

            const user = await User.findByIdAndUpdate(
                payment.payer,
                { $inc: { walletBalance: payment.grossAmount } },
                { new: true, session }
            );

            if (!user) {
                throw new Error(`Failed to update wallet for user ${payment.payer}`);
            }

            console.log(`✅ WALLET UPDATED: New balance R${user.walletBalance}`);

            await session.commitTransaction();

            // Log and notify OUTSIDE transaction (non-blocking)
            logActivity(
                payment.payer,
                'WALLET_TOPUP',
                'wallet',
                payment._id,
                `Added R${payment.grossAmount} via PayFast`
            ).catch(err => console.error('Log activity error:', err.message));

            sendNotification(payment.payer, {
                type: 'payment_received',
                title: 'Wallet Top-up Successful',
                message: `R${payment.grossAmount} has been added to your wallet`,
            }).catch(err => console.error('Notification error:', err.message));

            return {
                success: true,
                paymentId: payment._id,
                newBalance: user.walletBalance,
            };
        }

        if (status === 'FAILED') {
            payment.status = 'failed';
            await payment.save({ session });
            await session.commitTransaction();
            return { success: false, message: 'Payment failed', paymentId: payment._id };
        }

        await session.commitTransaction();
        return { success: false, status, paymentId: payment._id };
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
};

// ================= VALIDATE AMOUNT =================
exports.validateTopupAmount = (amount) => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed)) return { valid: false, message: 'Invalid amount' };
    if (parsed < 10) return { valid: false, message: 'Minimum top-up amount is R10' };
    if (parsed > 100000) return { valid: false, message: 'Maximum top-up amount is R100,000' };
    return { valid: true, amount: parsed };
};

// ================= WALLET TOPUP HISTORY =================
exports.getWalletTopupHistory = async (userId, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
        Payment.find({ payer: userId, type: 'wallet_topup', method: 'payfast' })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        Payment.countDocuments({ payer: userId, type: 'wallet_topup', method: 'payfast' }),
    ]);

    return {
        success: true,
        data: payments,
        pagination: {
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalItems: total,
        },
    };
};

// ================= REDIRECT URL =================
exports.getPaymentRedirectUrl = (data) => {
    return `${CONFIG.paymentUrl}?${new URLSearchParams(data).toString()}`;
};

module.exports = exports;


// ================= CONFIRM TOPUP (Return URL Fallback) =================
// Called by the frontend success page when PayFast redirects back.
// This is the fallback for local dev where ITN (notify_url) can't reach
// localhost. In production, ITN fires automatically and this is a no-op
// if the payment was already processed by the callback.
exports.confirmTopupFromReturn = async (paymentId, userId) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const payment = await Payment.findById(paymentId).session(session);
        if (!payment) throw new Error('Payment not found');

        // Security: ensure this user owns the payment
        if (payment.payer.toString() !== userId.toString()) {
            throw new Error('Unauthorized');
        }

        // Already processed by ITN — nothing to do
        if (payment.status === 'released') {
            await session.abortTransaction();
            const user = await User.findById(userId).select('walletBalance');
            return { success: true, alreadyProcessed: true, newBalance: user.walletBalance };
        }

        if (payment.status !== 'pending') {
            await session.abortTransaction();
            return { success: false, message: `Payment status is ${payment.status}` };
        }

        // In development/sandbox, trust the return URL redirect since user completed PayFast's process
        // In production, validate with PayFast to prevent fraud
        const nodeEnv = (process.env.NODE_ENV || 'development').trim().toLowerCase();
        const isProduction = nodeEnv === 'production';

        console.log(`\n🔍 TOPUP CONFIRM - Environment Check`);
        console.log(`   NODE_ENV raw: "${process.env.NODE_ENV}"`);
        console.log(`   NODE_ENV trimmed: "${nodeEnv}"`);
        console.log(`   Is Production: ${isProduction}`);

        let isValid = false;

        if (!isProduction) {
            // Development/Sandbox: Trust the redirect
            console.log('🏖️  SANDBOX MODE: Trusting return URL redirect (skipping PayFast validation)');
            isValid = true;
        } else {
            // Production: Validate with PayFast
            console.log('🔒 PRODUCTION MODE: Validating with PayFast...');

            const verifyData = {
                merchant_id: String(CONFIG.merchantId).trim(),
                merchant_key: String(CONFIG.merchantKey).trim(),
                m_payment_id: String(paymentId),
            };
            verifyData.signature = generateSignature(verifyData);

            try {
                console.log('📤 Sending validation request to PayFast...');
                const response = await axios.post(
                    CONFIG.validateUrl,
                    new URLSearchParams(verifyData).toString(),
                    {
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        timeout: 5000
                    }
                );
                console.log('📥 PayFast response:', response.status, response.data);
                isValid = response.data === 'VALID';
                console.log(`✅ PayFast validation: ${response.data}`);
            } catch (e) {
                console.error('❌ PayFast validation error:', {
                    message: e.message,
                    status: e.response?.status,
                    data: e.response?.data
                });
                isValid = false;
            }
        }

        if (!isValid) {
            await session.abortTransaction();
            console.error('❌ Payment validation failed - rejecting');
            return { success: false, message: 'PayFast could not confirm payment' };
        }

        console.log(`✅ Payment validation passed\n`);

        // Credit the wallet
        payment.status = 'released';
        payment.releasedAt = new Date();
        await payment.save({ session });

        console.log(`💰 UPDATING WALLET (Return): User ${payment.payer}, Amount R${payment.grossAmount}`);

        const user = await User.findByIdAndUpdate(
            payment.payer,
            { $inc: { walletBalance: payment.grossAmount } },
            { new: true, session }
        );

        if (!user) {
            throw new Error(`Failed to update wallet for user ${payment.payer}`);
        }

        console.log(`✅ WALLET UPDATED (Return): New balance R${user.walletBalance}`);

        await session.commitTransaction();

        // Log and notify OUTSIDE transaction (non-blocking)
        logActivity(
            payment.payer,
            'WALLET_TOPUP',
            'wallet',
            payment._id,
            `Added R${payment.grossAmount} via PayFast (return-url confirm)`
        ).catch(err => console.error('Log activity error:', err.message));

        sendNotification(payment.payer, {
            type: 'payment_received',
            title: 'Wallet Top-up Successful',
            message: `R${payment.grossAmount} has been added to your wallet`,
        }).catch(err => console.error('Notification error:', err.message));

        return {
            success: true,
            alreadyProcessed: false,
            paymentId: payment._id,
            amount: payment.grossAmount,
            newBalance: user.walletBalance,
        };
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
};