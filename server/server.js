require('dotenv').config()

const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const Task = require('./models/task')
const Schedule = require('./models/schedule')
const StudySession = require('./models/studySession')
const User = require('./models/user')

const app = express()
const PORT = process.env.PORT || 5000

// ==================== MIDDLEWARE ====================

app.use(express.json())

// CORS is set here only. Do not also set it in vercel.json.
app.use(
  cors({
    origin: [
      'https://focusflow-9k1t.vercel.app',
      'http://localhost:5173',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

// ==================== DATABASE ====================

mongoose.set('bufferCommands', false)

// Reuse one connection between requests (needed on Vercel serverless).
const cached =
  global.mongooseCache ||
  (global.mongooseCache = { conn: null, promise: null })

async function connectDB() {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn
  }

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not configured')
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 8000,
      })
      .catch((error) => {
        cached.promise = null
        throw error
      })
  }

  cached.conn = await cached.promise
  return cached.conn
}

// Make sure the database is connected before any route runs.
app.use(async (req, res, next) => {
  try {
    await connectDB()
    next()
  } catch (error) {
    cached.conn = null
    cached.promise = null
    console.error('Database connection failed:', error.message)

    return res.status(500).json({
      message: 'Database connection failed. Please try again.',
    })
  }
})

// Quick check that the API is running: /api/health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// ==================== AUTHENTICATION ====================

// Verify the login token before allowing access to private data.
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Authentication required. Please log in.',
    })
  }

  const token = authHeader.slice(7)

  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not configured')

    return res.status(500).json({
      message: 'Authentication is not configured.',
    })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    if (
      !decoded.userId ||
      !mongoose.isValidObjectId(decoded.userId)
    ) {
      return res.status(401).json({
        message: 'Invalid authentication token.',
      })
    }

    req.userId = decoded.userId
    next()
  } catch (error) {
    return res.status(401).json({
      message: 'Your session is invalid or expired. Please log in again.',
    })
  }
}

// ==================== REGISTER ====================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body

    if (
      typeof name !== 'string' ||
      !name.trim() ||
      typeof email !== 'string' ||
      !email.trim() ||
      typeof password !== 'string' ||
      !password
    ) {
      return res.status(400).json({
        message: 'Name, email and password are required.',
      })
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters.',
      })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const existingUser = await User.findOne({
      email: normalizedEmail,
    })

    if (existingUser) {
      return res.status(409).json({
        message: 'An account with this email already exists.',
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    })

    const savedUser = await user.save()

    return res.status(201).json({
      message: 'Account created successfully.',
      user: {
        id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email,
      },
    })
  } catch (error) {
    console.error('Registration error:', error.message)

    if (error.code === 11000) {
      return res.status(409).json({
        message: 'An account with this email already exists.',
      })
    }

    return res.status(500).json({
      message: 'Failed to create account.',
    })
  }
})

// ==================== LOGIN ====================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (
      typeof email !== 'string' ||
      !email.trim() ||
      typeof password !== 'string' ||
      !password
    ) {
      return res.status(400).json({
        message: 'Email and password are required.',
      })
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    })

    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password.',
      })
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    )

    if (!passwordMatch) {
      return res.status(401).json({
        message: 'Invalid email or password.',
      })
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not configured')

      return res.status(500).json({
        message: 'Authentication is not configured.',
      })
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '7d',
      }
    )

    return res.json({
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    })
  } catch (error) {
    console.error('Login error:', error.message)

    return res.status(500).json({
      message: 'Failed to log in.',
    })
  }
})

// ==================== PROTECT PRIVATE ROUTES ====================

app.use('/api/tasks', authenticateToken)
app.use('/api/schedules', authenticateToken)
app.use('/api/study-sessions', authenticateToken)

// ==================== TASKS ====================

// Get only the logged-in user's tasks.
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await Task.find({
      user: req.userId,
    }).sort({ _id: -1 })

    return res.json(tasks)
  } catch (error) {
    console.error('Get tasks error:', error.message)

    return res.status(500).json({
      message: 'Failed to get tasks.',
    })
  }
})

// Create a task owned by the logged-in user.
app.post('/api/tasks', async (req, res) => {
  try {
    const { title, deadline } = req.body

    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        message: 'Task title is required.',
      })
    }

    const newTask = new Task({
      title: title.trim(),
      deadline:
        typeof deadline === 'string' && deadline
          ? deadline
          : 'No deadline',
      user: req.userId,
    })

    const savedTask = await newTask.save()

    return res.status(201).json(savedTask)
  } catch (error) {
    console.error('Create task error:', error.message)

    return res.status(500).json({
      message: 'Failed to create task.',
    })
  }
})

// Update only a task owned by the logged-in user.
app.put('/api/tasks/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({
        message: 'Task not found.',
      })
    }

    const updateData = {}

    if (req.body.title !== undefined) {
      if (
        typeof req.body.title !== 'string' ||
        !req.body.title.trim()
      ) {
        return res.status(400).json({
          message: 'Task title cannot be empty.',
        })
      }

      updateData.title = req.body.title.trim()
    }

    if (req.body.deadline !== undefined) {
      if (typeof req.body.deadline !== 'string') {
        return res.status(400).json({
          message: 'Invalid deadline.',
        })
      }

      updateData.deadline = req.body.deadline
    }

    if (req.body.completed !== undefined) {
      if (typeof req.body.completed !== 'boolean') {
        return res.status(400).json({
          message: 'Invalid completed value.',
        })
      }

      updateData.completed = req.body.completed
    }

    const updatedTask = await Task.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.userId,
      },
      { $set: updateData },
      {
        new: true,
        runValidators: true,
      }
    )

    if (!updatedTask) {
      return res.status(404).json({
        message: 'Task not found.',
      })
    }

    return res.json(updatedTask)
  } catch (error) {
    console.error('Update task error:', error.message)

    return res.status(500).json({
      message: 'Failed to update task.',
    })
  }
})

// Delete only a task owned by the logged-in user.
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({
        message: 'Task not found.',
      })
    }

    const deletedTask = await Task.findOneAndDelete({
      _id: req.params.id,
      user: req.userId,
    })

    if (!deletedTask) {
      return res.status(404).json({
        message: 'Task not found.',
      })
    }

    return res.json({
      message: 'Task deleted successfully.',
    })
  } catch (error) {
    console.error('Delete task error:', error.message)

    return res.status(500).json({
      message: 'Failed to delete task.',
    })
  }
})

// ==================== SCHEDULES ====================

// Get only the logged-in user's schedules.
app.get('/api/schedules', async (req, res) => {
  try {
    const schedules = await Schedule.find({
      user: req.userId,
    }).sort({
      date: 1,
      startTime: 1,
    })

    return res.json(schedules)
  } catch (error) {
    console.error('Get schedules error:', error.message)

    return res.status(500).json({
      message: 'Failed to get schedules.',
    })
  }
})

// Create a schedule owned by the logged-in user.
app.post('/api/schedules', async (req, res) => {
  try {
    const {
      subject,
      date,
      startTime,
      endTime,
      classLink,
    } = req.body

    if (
      typeof subject !== 'string' ||
      !subject.trim() ||
      typeof date !== 'string' ||
      !date ||
      typeof startTime !== 'string' ||
      !startTime ||
      typeof endTime !== 'string' ||
      !endTime
    ) {
      return res.status(400).json({
        message: 'Subject, date, start time and end time are required.',
      })
    }

    const newSchedule = new Schedule({
      subject: subject.trim(),
      date,
      startTime,
      endTime,
      classLink:
        typeof classLink === 'string' ? classLink : '',
      user: req.userId,
    })

    const savedSchedule = await newSchedule.save()

    return res.status(201).json(savedSchedule)
  } catch (error) {
    console.error('Create schedule error:', error.message)

    return res.status(500).json({
      message: 'Failed to create schedule.',
    })
  }
})

// Delete only a schedule owned by the logged-in user.
app.delete('/api/schedules/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({
        message: 'Schedule not found.',
      })
    }

    const deletedSchedule = await Schedule.findOneAndDelete({
      _id: req.params.id,
      user: req.userId,
    })

    if (!deletedSchedule) {
      return res.status(404).json({
        message: 'Schedule not found.',
      })
    }

    return res.json({
      message: 'Schedule deleted successfully.',
    })
  } catch (error) {
    console.error('Delete schedule error:', error.message)

    return res.status(500).json({
      message: 'Failed to delete schedule.',
    })
  }
})

// ==================== STUDY SESSIONS ====================

// Get only the logged-in user's study sessions.
app.get('/api/study-sessions', async (req, res) => {
  try {
    const sessions = await StudySession.find({
      user: req.userId,
    }).sort({
      date: 1,
    })

    return res.json(sessions)
  } catch (error) {
    console.error('Get study sessions error:', error.message)

    return res.status(500).json({
      message: 'Failed to get study sessions.',
    })
  }
})

// Create a study session owned by the logged-in user.
app.post('/api/study-sessions', async (req, res) => {
  try {
    const { subject, date, minutes } = req.body

    if (
      typeof subject !== 'string' ||
      !subject.trim() ||
      typeof date !== 'string' ||
      !date ||
      !Number.isFinite(minutes) ||
      minutes <= 0
    ) {
      return res.status(400).json({
        message: 'Valid subject, date and minutes are required.',
      })
    }

    const newSession = new StudySession({
      subject: subject.trim(),
      date,
      minutes,
      user: req.userId,
    })

    const savedSession = await newSession.save()

    return res.status(201).json(savedSession)
  } catch (error) {
    console.error('Create study session error:', error.message)

    return res.status(500).json({
      message: 'Failed to create study session.',
    })
  }
})

// Delete only a study session owned by the logged-in user.
app.delete('/api/study-sessions/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({
        message: 'Study session not found.',
      })
    }

    const deletedSession = await StudySession.findOneAndDelete({
      _id: req.params.id,
      user: req.userId,
    })

    if (!deletedSession) {
      return res.status(404).json({
        message: 'Study session not found.',
      })
    }

    return res.json({
      message: 'Study session deleted successfully.',
    })
  } catch (error) {
    console.error('Delete study session error:', error.message)

    return res.status(500).json({
      message: 'Failed to delete study session.',
    })
  }
})

// ==================== START SERVER ====================

// Run a normal server only when started with: node server.js
// On Vercel the app is exported and Vercel calls it for each request.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

module.exports = app