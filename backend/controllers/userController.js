import User from '../models/User.js';
import bcrypt from 'bcryptjs';

/**
 * @desc    Get all users with pagination (Capped at 100)
 * @route   GET /api/users
 * @access  Private / Admin
 * 
 * Features:
 * - Feature 3: Admin user management list
 * - Supporting Feature #9: Pagination on the user list (capped at 100)
 */
export const getUsers = async (req, res, next) => {
  try {
    // Pagination params
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    let limit = parseInt(req.query.limit, 10) || 10;

    // Feature #9: Explicitly capped at 100 per page
    if (limit > 100) {
      limit = 100;
    }
    if (limit < 1) {
      limit = 10;
    }

    const skip = (page - 1) * limit;

    // Optional filtering by role or search keyword
    const filter = {};
    if (req.query.role) {
      filter.role = req.query.role;
    }
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [{ name: searchRegex }, { email: searchRegex }];
    }

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(total / limit) || 1;

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
      data: users,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get single user by ID
 * @route   GET /api/users/:id
 * @access  Private / Admin
 * 
 * Feature 3: Admin user management - get one
 */
export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `User not found with id of ${req.params.id}`,
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Create a new user (Admin creation)
 * @route   POST /api/users
 * @access  Private / Admin
 * 
 * Feature 3: Admin user management - create
 */
export const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password',
      });
    }

    // Check duplicate
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address already exists',
      });
    }

    // Role can be assigned by admin, with validation
    const validRoles = ['user', 'company', 'admin'];
    const userRole = role && validRoles.includes(role) ? role : 'user';

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: userRole,
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update a user
 * @route   PUT /api/users/:id
 * @access  Private / Admin (or self with privilege restrictions)
 * 
 * Features:
 * - Feature 3: Admin user management - update
 * - Supporting Feature #10: Protection against privilege escalation (role stripped from updates)
 */
export const updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `User not found with id of ${req.params.id}`,
      });
    }

    const updateData = { ...req.body };

    // PRIVILEGE ESCALATION PROTECTION:
    // If the requesting user is NOT an admin, strip any attempts to change 'role'
    if (req.user.role !== 'admin') {
      delete updateData.role;
    } else if (updateData.role) {
      // Even if admin, validate role against allowed list
      const validRoles = ['user', 'company', 'admin'];
      if (!validRoles.includes(updateData.role)) {
        return res.status(400).json({
          success: false,
          message: `Invalid role '${updateData.role}'. Allowed roles: user, company, admin`,
        });
      }
    }

    // Handle password update if provided
    if (updateData.password) {
      if (updateData.password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long',
        });
      }
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(updateData.password, salt);
    }

    // Update name and email if provided
    if (updateData.name) user.name = updateData.name.trim();
    if (updateData.email) user.email = updateData.email.toLowerCase().trim();
    if (updateData.role && req.user.role === 'admin') user.role = updateData.role;
    if (updateData.password) user.password = updateData.password;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Delete a user
 * @route   DELETE /api/users/:id
 * @access  Private / Admin
 * 
 * Feature 3: Admin user management - delete
 */
export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `User not found with id of ${req.params.id}`,
      });
    }

    // Safety guard: Admin cannot delete their own current account
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({
        success: false,
        message: 'Security protection: An administrator cannot delete their own active account.',
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      deletedId: req.params.id,
    });
  } catch (err) {
    next(err);
  }
};
