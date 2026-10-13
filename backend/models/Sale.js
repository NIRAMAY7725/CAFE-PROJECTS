import mongoose from 'mongoose';

/**
 * Sale Schema for Cafe POS and Sales Dashboard Compatibility
 */
const SaleSchema = new mongoose.Schema(
  {
    order_id: {
      type: String,
      default: () => 'ORD-' + Math.floor(100000 + Math.random() * 900000),
    },
    item_name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
    },
    category: {
      type: String,
      default: 'beverage',
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be positive'],
    },
    quantity: {
      type: Number,
      default: 1,
      min: [1, 'Quantity must be at least 1'],
    },
    total: {
      type: Number,
      default: function () {
        return (this.price || 0) * (this.quantity || 1);
      },
    },
    customer_name: {
      type: String,
      default: 'Walk-in Guest',
    },
    payment_method: {
      type: String,
      enum: ['cash', 'upi', 'card', 'wallet'],
      default: 'upi',
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Auto calculate total before save
SaleSchema.pre('save', function (next) {
  if (this.price && this.quantity) {
    this.total = this.price * this.quantity;
  }
  next();
});

export default mongoose.model('Sale', SaleSchema);
