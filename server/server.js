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
const PORT = 5000

app.use(express.json())
app.use(cors({
  origin: [
    'https://focusflow-9k1t.vercel.app',
    'http://localhost:5173',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected successfully')
  })
  .catch((error) => {
    console.error('MongoDB connection failed:', error.message)
  })
// ==================== AUTHENTICATION ====================

// REGISTER
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'Name, email and password are required',
      })
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters',
      })
    }

    const existingUser = await User.findOne({
      email: email.toLowerCase(),
    })

    if (existingUser) {
      return res.status(400).json({
        message: 'An account with this email already exists',
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = new User({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
    })

    const savedUser = await user.save()

    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email,
      },
    })
  } catch (error) {
    console.error('Registration error:', error)

    res.status(500).json({
      message: 'Failed to create account',
    })
  }
})

// LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required',
      })
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
    })

    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password',
      })
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    )

    if (!passwordMatch) {
      return res.status(401).json({
        message: 'Invalid email or password',
      })
    }

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '7d',
      }
    )

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    })
  } catch (error) {
    console.error('Login error:', error)

    res.status(500).json({
      message: 'Failed to login',
    })
  }
})
// ==================== TASKS ====================

app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await Task.find()
    res.json(tasks)
  } catch (error) {
    res.status(500).json({ message: 'Failed to get tasks' })
  }
})

app.post('/api/tasks', async (req, res) => {
  try {
    const newTask = new Task({
      title: req.body.title,
      deadline: req.body.deadline,
    })

    const savedTask = await newTask.save()
    res.status(201).json(savedTask)
  } catch (error) {
    res.status(500).json({ message: 'Failed to create task' })
  }
})

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const updateData = {}

    if (req.body.title !== undefined) {
      updateData.title = req.body.title
    }

    if (req.body.deadline !== undefined) {
      updateData.deadline = req.body.deadline
    }

    if (req.body.completed !== undefined) {
      updateData.completed = req.body.completed
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    )

    if (!updatedTask) {
      return res.status(404).json({ message: 'Task not found' })
    }

    res.json(updatedTask)
  } catch (error) {
    res.status(500).json({ message: 'Failed to update task' })
  }
})

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id)
    res.json({ message: 'Task deleted successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete task' })
  }
})

// ==================== SCHEDULE ====================

app.get('/api/schedules', async (req, res) => {
  try {
    const schedules = await Schedule.find().sort({
      date: 1,
      startTime: 1,
    })

    res.json(schedules)
  } catch (error) {
    res.status(500).json({ message: 'Failed to get schedules' })
  }
})

app.post('/api/schedules', async (req, res) => {
  try {
    const newSchedule = new Schedule({
      subject: req.body.subject,
      date: req.body.date,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      classLink: req.body.classLink,
    })

    const savedSchedule = await newSchedule.save()

    res.status(201).json(savedSchedule)
  } catch (error) {
    res.status(500).json({ message: 'Failed to create schedule' })
  }
})

app.delete('/api/schedules/:id', async (req, res) => {
  try {
    await Schedule.findByIdAndDelete(req.params.id)

    res.json({ message: 'Schedule deleted successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete schedule' })
  }
})

// ==================== STUDY SESSIONS ====================

app.get('/api/study-sessions', async (req, res) => {
  try {
    const sessions = await StudySession.find().sort({
      date: 1,
    })

    res.json(sessions)
  } catch (error) {
    res.status(500).json({
      message: 'Failed to get study sessions',
    })
  }
})

app.post('/api/study-sessions', async (req, res) => {
  try {
    const newSession = new StudySession({
      subject: req.body.subject,
      date: req.body.date,
      minutes: req.body.minutes,
    })

    const savedSession = await newSession.save()

    res.status(201).json(savedSession)
  } catch (error) {
    res.status(500).json({
      message: 'Failed to create study session',
    })
  }
})

app.delete('/api/study-sessions/:id', async (req, res) => {
  try {
    await StudySession.findByIdAndDelete(req.params.id)

    res.json({
      message: 'Study session deleted successfully',
    })
  } catch (error) {
    res.status(500).json({
      message: 'Failed to delete study session',
    })
  }
})

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})