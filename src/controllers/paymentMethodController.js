
const { User } = require('../models/index');
const { v4: uuidv4 } = require('uuid');

/**
 * GET ALL PAYMENT METHODS
 * @route   GET /api/payments/methods
 * @access  Private (User)
 */
exports.getPaymentMethods = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('paymentMethods');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      data: user.paymentMethods || [],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * ADD PAYMENT METHOD
 * @route   POST /api/payments/methods
 * @access  Private (User)
 */
exports.addPaymentMethod = async (req, res, next) => {
  try {
    const { type, name, mask, provider = 'stripe', metadata } = req.body;

    if (!type || !['card', 'bank'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid payment method type' });
    }

    if (!name) {
      return res.status(400).json({ success: false, message: 'Payment method name is required' });
    }

    const newMethod = {
      id: uuidv4(),
      type,
      name,
      mask: mask || '',
      provider,
      metadata: metadata || {},
      isDefault: false,
      createdAt: new Date(),
    };

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $push: { paymentMethods: newMethod } },
      { new: true }
    ).select('paymentMethods');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(201).json({
      success: true,
      message: 'Payment method added successfully',
      data: newMethod,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * UPDATE PAYMENT METHOD
 * @route   PUT /api/payments/methods/:id
 * @access  Private (User)
 */
exports.updatePaymentMethod = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, metadata } = req.body;

    if (!name && !metadata) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    const updateData = {};
    if (name) updateData['paymentMethods.$.name'] = name;
    if (metadata) updateData['paymentMethods.$.metadata'] = metadata;

    const user = await User.findOneAndUpdate(
      { _id: req.user._id, 'paymentMethods.id': id },
      { $set: updateData },
      { new: true }
    ).select('paymentMethods');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Payment method not found' });
    }

    const updatedMethod = user.paymentMethods.find((m) => m.id === id);

    res.json({
      success: true,
      message: 'Payment method updated successfully',
      data: updatedMethod,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE PAYMENT METHOD
 * @route   DELETE /api/payments/methods/:id
 * @access  Private (User)
 */
exports.deletePaymentMethod = async (req, res, next) => {
  try {
    const { id } = req.params;

    // FIX 5: Fetch the user BEFORE the $pull to check whether the method
    // actually existed. The original code compared
    //   user.paymentMethods.length === (user.paymentMethods.length + 1)
    // which is mathematically impossible (always false), so the "not found"
    // branch was dead code and the endpoint always returned 200 even when
    // the method didn't exist.
    const before = await User.findById(req.user._id).select('paymentMethods');
    if (!before) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const methodExists = before.paymentMethods.some((m) => m.id === id);
    if (!methodExists) {
      return res.status(404).json({ success: false, message: 'Payment method not found' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { paymentMethods: { id } } },
      { new: true }
    ).select('paymentMethods');

    res.json({
      success: true,
      message: 'Payment method deleted successfully',
      data: user.paymentMethods,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * SET DEFAULT PAYMENT METHOD
 * @route   PUT /api/payments/methods/:id/default
 * @access  Private (User)
 */
exports.setDefaultPaymentMethod = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Remove default from all methods
    await User.updateOne(
      { _id: req.user._id },
      { $set: { 'paymentMethods.$[].isDefault': false } }
    );

    // Set this method as default
    const user = await User.findOneAndUpdate(
      { _id: req.user._id, 'paymentMethods.id': id },
      { $set: { 'paymentMethods.$.isDefault': true } },
      { new: true }
    ).select('paymentMethods');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Payment method not found' });
    }

    const defaultMethod = user.paymentMethods.find((m) => m.id === id);

    res.json({
      success: true,
      message: 'Default payment method set successfully',
      data: defaultMethod,
    });
  } catch (err) {
    next(err);
  }
};