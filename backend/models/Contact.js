import mongoose from 'mongoose';

/**
 * Contact Schema with Mongoose Validation
 * Supporting Features:
 * - Mongoose validation on the Contact model
 * - Public submit contact form
 * - Admin-only inbox
 */
const ContactSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide your name'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please provide your email address'],
      trim: true,
      lowercase: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please provide a valid email address',
      ],
    },
    subject: {
      type: String,
      trim: true,
      maxlength: [200, 'Subject cannot exceed 200 characters'],
      default: 'General Inquiry',
    },
    message: {
      type: String,
      required: [true, 'Please enter your message'],
      trim: true,
      minlength: [5, 'Message must be at least 5 characters long'],
      maxlength: [2500, 'Message cannot exceed 2500 characters'],
    },
    status: {
      type: String,
      enum: {
        values: ['unread', 'read', 'archived'],
        message: 'Status must be unread, read, or archived',
      },
      default: 'unread',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Contact', ContactSchema);
