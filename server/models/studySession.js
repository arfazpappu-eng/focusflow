const mongoose = require('mongoose')

const studySessionSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: true,
    },

    date: {
      type: String,
      required: true,
    },

    minutes: {
      type: Number,
      required: true,
    },

    // Each new study session belongs to one user account.
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

const StudySession = mongoose.model(
  'StudySession',
  studySessionSchema
)

module.exports = StudySession