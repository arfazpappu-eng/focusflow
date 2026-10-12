const mongoose = require('mongoose')

const scheduleSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: true,
    },

    date: {
      type: String,
      required: true,
    },

    startTime: {
      type: String,
      required: true,
    },

    endTime: {
      type: String,
      required: true,
    },

    classLink: {
      type: String,
      default: '',
    },

    // Each new schedule belongs to one user account.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

const Schedule = mongoose.model('Schedule', scheduleSchema)

module.exports = Schedule