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
  },
  {
    timestamps: true,
  }
)

const Schedule = mongoose.model(
  'Schedule',
  scheduleSchema
)

module.exports = Schedule