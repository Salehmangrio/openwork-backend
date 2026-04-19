const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { Notification } = require('../models/index');
const { sendEmail } = require('../utils/email');
const { logActivity } = require('../utils/helpers');

const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

// Firebase Admin SDK initialization
let admin;
try {
  admin = require('firebase-admin');

  // Parse private key - handle escaped newlines
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey) {
    // Replace literal \n with actual newlines
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  const serviceAccount = {
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID || 'openwork-saleh',
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: privateKey,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`,
  };

  // Only initialize if we have the required credentials
  if (serviceAccount.private_key && serviceAccount.client_email) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log(' Firebase Admin SDK initialized successfully');
  } else {
    console.log('  Firebase Admin SDK credentials not found, using fallback mode');
  }
} catch (error) {
  console.log('  Firebase Admin SDK not initialized:', error.message);
  console.log('   Firebase auth will use fallback mode');
  admin = null;
}

// ─── Helper: send token response ─────────────────────────────
const sendToken = (user, statusCode, res) => {
  const token = user.getSignedToken();
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage,
      isVerified: user.isVerified,
      aiSkillScore: user.aiSkillScore,
      walletBalance: user.walletBalance,
      averageRating: user.averageRating,
      totalEarned: user.totalEarned,
      totalSpent: user.totalSpent,
      completedJobs: user.completedJobs,
    },
  });
};

// ─── Helper: send token response with custom expiry ───────────
const sendTokenWithExpiry = (user, statusCode, res, expiry = '7d') => {
  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: expiry }
  );
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage,
      isVerified: user.isVerified,
      aiSkillScore: user.aiSkillScore,
      walletBalance: user.walletBalance,
      averageRating: user.averageRating,
      totalEarned: user.totalEarned,
      totalSpent: user.totalSpent,
      completedJobs: user.completedJobs,
    },
  });
};

// ─── @POST /api/auth/register ─────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const { fullName, email, password, role, phone, bio } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered' });

    const user = await User.create({
      fullName, email, password, phone, bio,
      role: role || 'freelancer',
      canActAsFreelancer: role !== 'client',
      canActAsClient: role === 'client',
    });

    // 1. Generate a secure email verification token
    const emailToken = crypto.randomBytes(32).toString('hex');

    // 2. Save token + expiry to user
    user.emailVerifyToken = emailToken;
    user.emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await user.save();

    // 3. Send the verification email asynchronously (don't block response)
    sendVerificationEmail(user.email, user.fullName, emailToken)
      .catch(err => console.error('❌ Email send failed during registration:', err.message));

    // 4. Create welcome notification
    Notification.create({
      recipient: user._id,
      type: 'system',
      title: 'Welcome to OpenWork! 🎉',
      message: `Hi ${user.fullName}! Complete your profile to start getting AI-matched with opportunities.`,
      link: '/dashboard/profile',
    }).catch(err => console.error('Failed to create notification:', err.message));

    // 5. Log activity
    await logActivity(user._id, 'register', 'User', user._id, 'New user registered', req.ip);

    // 6. Send single response with token
    sendToken(user, 201, res);

  } catch (err) {
    // 429 handling for too many requests
    if (err.code === 429) {
      return res.status(429).json({ success: false, message: 'Too many requests. Try again later.' });
    }
    next(err);
  }
};

// ─── @POST /api/auth/login ────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    // Account lock check
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({ success: false, message: `Account locked. Try again in ${minutesLeft} minutes.` });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= 5) {
        user.lockUntil = Date.now() + 30 * 60 * 1000; // 30 min
        await user.save({ validateBeforeSave: false });
        return res.status(423).json({ success: false, message: 'Too many failed attempts. Account locked for 30 minutes.' });
      }
      await user.save({ validateBeforeSave: false });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Reset login attempts
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    await logActivity(user._id, 'login', 'User', user._id, 'User logged in', req.ip);

    sendToken(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// ─── @GET /api/auth/me ────────────────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
        isVerified: user.isVerified,
        aiSkillScore: user.aiSkillScore,
        walletBalance: user.walletBalance,
        averageRating: user.averageRating,
        totalEarned: user.totalEarned,
        totalGrossEarned: user.totalGrossEarned,
        totalFeesPaid: user.totalFeesPaid,
        pendingEarnings: user.pendingEarnings,
        withdrawnTotal: user.withdrawnTotal,
        totalSpent: user.totalSpent,
        completedJobs: user.completedJobs,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── @GET /api/auth/verify-email/:token ───────────────────────
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    // Find user with this token that hasn't expired
    const user = await User.findOne({
      emailVerifyToken: token,
      emailVerifyExpires: { $gt: new Date() } // token not expired
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification link.' });
    }

    // Mark as verified and clear the token
    user.emailVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpires = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully!' });

  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
}

// POST /api/auth/resend-verification  (in case user needs a new link)
exports.resendVerification = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user.emailVerified) {
      return res.status(400).json({ message: 'Email is already verified.' });
    }

    const emailToken = crypto.randomBytes(32).toString('hex');
    user.emailVerifyToken = emailToken;
    user.emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    // Send email asynchronously without blocking response
    sendVerificationEmail(user.email, user.fullName, emailToken)
      .catch(err => console.error('Failed to send verification email:', err));

    res.json({ message: 'Verification email sent!' });

  } catch (err) {
    res.status(500).json({ message: 'Failed to send email' });
  }
};

// ─── @POST /api/auth/forgot-password ──────────────────────────
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    try {
      // Send password reset email via Resend
      await sendPasswordResetEmail(user.email, user.fullName, resetToken);

      await logActivity(user._id, 'forgot_password', 'User', user._id, 'Password reset requested', req.ip);

      res.status(200).json({ success: true, message: 'Password reset email sent' });
    } catch (err) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
      return next(err);
    }
  } catch (err) {
    next(err);
  }
};

// ─── @PUT /api/auth/reset-password/:token ──────────────────────
exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password, passwordConfirm } = req.body;

    if (!token) return res.status(400).json({ success: false, message: 'Token is required' });
    if (!password || !passwordConfirm) return res.status(400).json({ success: false, message: 'Password is required' });
    if (password !== passwordConfirm) return res.status(400).json({ success: false, message: 'Passwords do not match' });

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired token' });

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    await logActivity(user._id, 'reset_password', 'User', user._id, 'Password reset', req.ip);

    sendToken(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// ─── @PUT /api/auth/update-password ───────────────────────────
exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, password, passwordConfirm } = req.body;

    if (!currentPassword || !password || !passwordConfirm) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (password !== passwordConfirm) {
      return res.status(400).json({ success: false, message: 'New passwords do not match' });
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Current password is incorrect' });

    user.password = password;
    await user.save();

    await logActivity(user._id, 'update_password', 'User', user._id, 'Password updated', req.ip);

    sendToken(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// ─── @POST /api/auth/google ─────────────────────────────────────
exports.googleAuth = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Google ID token is required' });
    }

    // Verify Google token with clock skew tolerance
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
      clockSkewMillis: 300000, // 5 minutes tolerance for clock sync issues
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub } = payload;

    // Find existing user by email
    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      // CASE 1: USER EXISTS - LOGIN
      // Update last login
      user.lastLogin = Date.now();
      user.loginAttempts = 0;
      user.lockUntil = undefined;

      // If user doesn't have googleId, link it
      if (!user.googleId) {
        user.googleId = sub;
      }

      // Update profile image if not set
      if (!user.profileImage && picture) {
        user.profileImage = picture;
      }

      await user.save({ validateBeforeSave: false });

      await logActivity(user._id, 'google_login', 'User', user._id, 'User logged in via Google', req.ip);

      sendTokenWithExpiry(user, 200, res, '7d');
    } else {
      // CASE 2: NEW USER - ASK FOR ROLE SELECTION
      // Return a response asking user to select their role
      res.status(200).json({
        success: true,
        requiresRoleSelection: true,
        googleData: {
          idToken,
          fullName: name,
          email: email.toLowerCase(),
          picture: picture,
          sub: sub,
        },
        message: 'Please select your role to complete signup',
      });
    }
  } catch (err) {
    console.error('Google auth error:', err);
    if (err.message && err.message.includes('Wrong number of segments')) {
      return res.status(400).json({ success: false, message: 'Invalid Google token' });
    }
    if (err.message && err.message.includes('Token used too late')) {
      return res.status(400).json({ success: false, message: 'Google token expired' });
    }
    next(err);
  }
};

// ─── @POST /api/auth/google-complete ───────────────────────────────
// Complete Google signup with selected role
exports.googleComplete = async (req, res, next) => {
  try {
    const { idToken, role } = req.body;

    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Google ID token is required' });
    }

    if (!role || !['freelancer', 'client'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be either "freelancer" or "client"' });
    }

    // Verify Google token again
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
      clockSkewMillis: 300000,
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub } = payload;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'User already exists. Please log in instead.' });
    }

    // Generate a random password for Google users
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 12);
    const now = new Date();

    // Set role-specific defaults
    const userData = {
      fullName: name,
      email: email.toLowerCase(),
      googleId: sub,
      profileImage: picture || '',
      password: hashedPassword,
      isVerified: true, // Google users auto-verified
      isActive: true,
      isBanned: false,
      twoFactorEnabled: false,
      loginAttempts: 0,
      role: role,
      canActAsClient: role === 'client' || role === 'both',
      canActAsFreelancer: role === 'freelancer' || role === 'both',
      // Freelancer profile defaults
      title: '',
      bio: '',
      skills: [],
      hourlyRate: 0,
      experienceLevel: 'junior',
      portfolioUrl: '',
      location: '',
      languages: [],
      availability: 'available',
      // Company defaults
      companyName: '',
      companySize: '',
      organizationType: '',
      // Financial defaults
      totalSpent: 0,
      budgetAllocated: 0,
      totalEarned: 0,
      totalJobs: 0,
      completedJobs: 0,
      totalGrossEarned: 0,
      totalFeesPaid: 0,
      walletBalance: 0,
      pendingEarnings: 0,
      withdrawnTotal: 0,
      // Rating defaults
      averageRating: 0,
      totalReviews: 0,
      responseTime: 0,
      repeatClients: 0,
      // AI defaults
      aiSkillScore: 0,
      aiRankScore: 0,
      // Notification preferences
      notifPrefs: {
        messages: true,
        jobMatches: true,
        payments: true,
        disputes: false,
        marketing: false,
      },
      // Fraud detection defaults
      fraudScore: 0,
      fraudFlags: [],
      // Array defaults
      portfolioFiles: [],
      education: [],
      workHistory: [],
      certifications: [],
      skillScoreHistory: [],
      paymentMethods: [],
      lastLogin: now,
    };

    const user = await User.create(userData);

    // Welcome notification
    await Notification.create({
      recipient: user._id,
      type: 'system',
      title: 'Welcome to OpenWork! 🎉',
      message: `Hi ${user.fullName}! Complete your profile to start getting ${role === 'client' ? 'hiring talent' : 'AI-matched with opportunities'}.`,
      link: '/dashboard/profile',
    });

    await logActivity(user._id, 'google_register', 'User', user._id, `User registered via Google as ${role}`, req.ip);

    sendTokenWithExpiry(user, 201, res, '7d');
  } catch (err) {
    console.error('Google complete signup error:', err);
    if (err.message && err.message.includes('Wrong number of segments')) {
      return res.status(400).json({ success: false, message: 'Invalid Google token' });
    }
    if (err.message && err.message.includes('Token used too late')) {
      return res.status(400).json({ success: false, message: 'Google token expired' });
    }
    next(err);
  }
};

// ─── @POST /api/auth/firebase-register ───────────────────────────────
// Register new user via Firebase (Google or Facebook)
// DO NOT use this for login - use /firebase-login instead
exports.firebaseRegister = async (req, res, next) => {
  try {
    const { idToken, provider } = req.body;

    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Firebase ID token is required' });
    }

    if (!provider || (provider !== 'google' && provider !== 'facebook')) {
      return res.status(400).json({ success: false, message: 'Provider must be google or facebook' });
    }

    // Verify Firebase ID token with timeout protection
    let decodedToken;
    try {
      if (admin) {
        const verificationPromise = admin.auth().verifyIdToken(idToken);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Firebase token verification timeout')), 8000)
        );
        decodedToken = await Promise.race([verificationPromise, timeoutPromise]);
      } else {
        decodedToken = { uid: 'dev_' + Date.now(), email: req.body.email, name: req.body.name };
      }
    } catch (error) {
      console.error('Firebase token verification error:', error.message);
      return res.status(401).json({ success: false, message: 'Invalid or expired Firebase token' });
    }

    const { uid, email, name, picture } = decodedToken;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required from Firebase' });
    }

    const normalizedEmail = email.toLowerCase();

    try {
      // Check if user already exists
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        console.warn(`[Firebase Register] User already exists: ${normalizedEmail}`);
        return res.status(409).json({
          success: false,
          message: 'User already registered. Please log in instead.'
        });
      }

      // Create new user (Firebase users are pre-verified)
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 12);
      const now = new Date();

      const newUser = await User.create({
        firebaseUid: uid,
        fullName: name || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        profileImage: picture || '',
        password: hashedPassword,
        provider: provider,
        role: 'freelancer',
        canActAsClient: false,
        canActAsFreelancer: true,
        title: '',
        bio: '',
        skills: [],
        hourlyRate: 0,
        experienceLevel: 'junior',
        portfolioUrl: '',
        location: '',
        languages: [],
        availability: 'available',
        companyName: '',
        companySize: '',
        organizationType: '',
        totalSpent: 0,
        budgetAllocated: 0,
        totalEarned: 0,
        totalJobs: 0,
        completedJobs: 0,
        totalGrossEarned: 0,
        totalFeesPaid: 0,
        walletBalance: 0,
        pendingEarnings: 0,
        withdrawnTotal: 0,
        averageRating: 0,
        totalReviews: 0,
        responseTime: 0,
        repeatClients: 0,
        aiSkillScore: 0,
        aiRankScore: 0,
        isVerified: true, 
        isActive: true,
        isBanned: false,
        twoFactorEnabled: false,
        loginAttempts: 0,
        notifPrefs: {
          messages: true,
          jobMatches: true,
          payments: true,
          disputes: false,
          marketing: false,
        },
        fraudScore: 0,
        fraudFlags: [],
        portfolioFiles: [],
        education: [],
        workHistory: [],
        certifications: [],
        skillScoreHistory: [],
        paymentMethods: [],
        lastLogin: now,
      });

      // Welcome notification
      await Notification.create({
        recipient: newUser._id,
        type: 'system',
        title: 'Welcome to OpenWork! 🎉',
        message: `Hi ${newUser.fullName}! Complete your profile to start getting AI-matched with opportunities.`,
        link: '/dashboard/profile',
      });

      await logActivity(newUser._id, `${provider}_register`, 'User', newUser._id, `User registered via ${provider}`, req.ip);

      console.log(`[Firebase Register] New user created: ${normalizedEmail}`);
      sendTokenWithExpiry(newUser, 201, res, '7d');
    } catch (err) {
      console.error('Firebase register error:', err);
      if (err.code === 11000) {
        return res.status(409).json({ success: false, message: 'User with this email already exists' });
      }
      next(err);
    }
  } catch (err) {
    console.error('Firebase register error:', err);
    next(err);
  }
};

// ─── @POST /api/auth/firebase-login ───────────────────────────────
// LOGIN ONLY - Find existing user via Firebase (Google or Facebook)
// DO NOT create users here - that's what /firebase-register is for
exports.firebaseAuth = async (req, res, next) => {
  try {
    const { idToken, provider } = req.body;

    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Firebase ID token is required' });
    }

    if (!provider || (provider !== 'google' && provider !== 'facebook')) {
      return res.status(400).json({ success: false, message: 'Provider must be google or facebook' });
    }

    // Verify Firebase ID token with timeout protection
    let decodedToken;
    try {
      if (admin) {
        const verificationPromise = admin.auth().verifyIdToken(idToken);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Firebase token verification timeout')), 8000)
        );
        decodedToken = await Promise.race([verificationPromise, timeoutPromise]);
      } else {
        decodedToken = { uid: 'dev_' + Date.now(), email: req.body.email, name: req.body.name };
      }
    } catch (error) {
      console.error('Firebase token verification error:', error.message);
      return res.status(401).json({ success: false, message: 'Invalid or expired Firebase token' });
    }

    const { uid, email, name } = decodedToken;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required from Firebase' });
    }

    const normalizedEmail = email.toLowerCase();

    try {
      // CRITICAL: Only find existing users - DO NOT create
      const user = await User.findOne({ email: normalizedEmail });

      if (!user) {
        console.warn(`[Firebase Login] User not found: ${normalizedEmail}`);
        return res.status(404).json({
          success: false,
          message: 'User not registered. Please sign up first.'
        });
      }

      // Update login info (but don't create)
      user.firebaseUid = uid;
      user.provider = provider;
      user.lastLogin = new Date();
      user.loginAttempts = 0;
      user.lockUntil = undefined;

      await user.save({ validateBeforeSave: false });

      await logActivity(user._id, `${provider}_login`, 'User', user._id, `User logged in via ${provider}`, req.ip);

      console.log(`[Firebase Login] User authenticated: ${normalizedEmail}`);
      sendTokenWithExpiry(user, 200, res, '7d');
    } catch (err) {
      console.error('Firebase login error:', err);
      next(err);
    }
  } catch (err) {
    console.error('Firebase login error:', err);
    next(err);
  }
};

// ─── @POST /api/auth/logout ────────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    await logActivity(req.user.id, 'logout', 'User', req.user.id, 'User logged out', req.ip);

    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};