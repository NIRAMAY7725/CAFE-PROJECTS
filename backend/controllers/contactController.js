import Contact from '../models/Contact.js';

/**
 * @desc    Public contact form submission
 * @route   POST /api/contact
 * @access  Public
 * 
 * Features:
 * - Feature 4: Contact form public submit
 * - Supporting Feature #8: Mongoose validation on Contact model
 */
export const submitContact = async (req, res, next) => {
  try {
    let { name, first_name, last_name, email, subject, message } = req.body;

    // Support both combined 'name' and separate 'first_name' / 'last_name'
    if (!name && (first_name || last_name)) {
      name = `${first_name || ''} ${last_name || ''}`.trim();
    }

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and message',
      });
    }

    const contact = await Contact.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      subject: (subject || 'General Inquiry').trim(),
      message: message.trim(),
      status: 'unread',
    });

    res.status(201).json({
      success: true,
      message: 'Thank you! Your message has been received by DAS CAFE team.',
      data: {
        id: contact._id,
        name: contact.name,
        email: contact.email,
        subject: contact.subject,
        status: contact.status,
        createdAt: contact.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get contact inbox messages
 * @route   GET /api/contact
 * @access  Private / Admin
 * 
 * Feature 4: Contact form admin-only inbox
 */
export const getContactInbox = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [{ name: searchRegex }, { email: searchRegex }, { subject: searchRegex }];
    }

    const total = await Contact.countDocuments(filter);
    const unreadCount = await Contact.countDocuments({ status: 'unread' });

    const messages = await Contact.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(total / limit) || 1;

    res.status(200).json({
      success: true,
      count: messages.length,
      total,
      unreadCount,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
      data: messages,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update contact message status (read / unread / archived)
 * @route   PATCH /api/contact/:id
 * @access  Private / Admin
 */
export const updateContactStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['unread', 'read', 'archived'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be unread, read, or archived.',
      });
    }

    const message = await Contact.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    res.status(200).json({
      success: true,
      message: `Message status updated to '${status}'`,
      data: message,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Delete contact message
 * @route   DELETE /api/contact/:id
 * @access  Private / Admin
 */
export const deleteContactMessage = async (req, res, next) => {
  try {
    const message = await Contact.findByIdAndDelete(req.params.id);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
      deletedId: req.params.id,
    });
  } catch (err) {
    next(err);
  }
};
