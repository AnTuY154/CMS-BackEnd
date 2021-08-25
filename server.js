require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const morgan = require('morgan');

require('./configs/passport.config');
require('./configs/job.config');

const authMiddleware = require('./middlewares/auth.middleware');

const authRoutes = require('./routes/auth.route');
const settingRoutes = require('./routes/setting.route');
const postRoutes = require('./routes/post.route');
const userRoutes = require('./routes/user.route');
const managerRoutes = require('./routes/manager.route');
const maketingRoutes = require('./routes/maketing.route');
const studentRoutes = require('./routes/student.route');
const shiftRoutes = require('./routes/shift.route');
const teacherRoutes = require('./routes/teacher.route');
const tutorRoutes = require('./routes/tutor.route');
const roomRoutes = require('./routes/room.route');
const selectRoutes = require('./routes/select.route');
const classRoutes = require('./routes/class.route');
const attendanceRoutes = require('./routes/attendance.route');
const courseRoutes = require('./routes/course.route');
const subjectRoutes = require('./routes/subject.route');
const permissionRoutes = require('./routes/permission.route');
const salaryRoutes = require('./routes/salary.route');
const registerRoutes = require('./routes/register.route');
const lessonRoutes = require('./routes/lesson.route');
const feedbackRoutes = require('./routes/feedback.route');
const centerRoutes = require('./routes/center.route');
const dashboardRoutes = require('./routes/dashboard.route');
const excelRoutes = require('./routes/excel.route');
const jobRoutes = require('./routes/job.route');

const HttpError = require('./models/http-error');
const multer = require('multer');
const multerS3 = require('multer-s3');
const aws = require('aws-sdk');

aws.config.update({
	secretAccessKey: process.env.AWS_SECRET_KEY,
	accessKeyId: process.env.AWS_ACCESS_KEY,
	region: process.env.AWS_REGION,
});

const app = express();

app.use(
	helmet({
		contentSecurityPolicy: false,
	})
);

const accessLogStream = fs.createWriteStream(
	path.join(__dirname, '/log/access.log'),
	{ flags: 'a' }
);

app.use(
	morgan(
		':remote-addr [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] - :response-time ms ":user-agent"',
		{
			stream: accessLogStream,
		}
	)
);

const whitelist = ['http://localhost:3000'];

app.use(
	cors({
		origin:
			process.env.ENVIRONMENT === 'prod'
				? '*'
				: (origin, callback) => {
						if (whitelist.indexOf(origin) !== -1) {
							callback(null, true);
						} else {
							callback(new Error('Cors policys.'));
						}
				  },
		methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
		allowedHeaders: 'Authorization,Origin,X-Requested-With,Content-Type,Accept',
		credentials: true,
	})
);

app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/setting', authMiddleware, settingRoutes);
app.use('/api/v1/post', authMiddleware, postRoutes);
app.use('/api/v1/room', authMiddleware, roomRoutes);
app.use('/api/v1/class', authMiddleware, classRoutes);
app.use('/api/v1/course', authMiddleware, courseRoutes);
app.use('/api/v1/select', authMiddleware, selectRoutes);
app.use('/api/v1/attendance', authMiddleware, attendanceRoutes);
app.use('/api/v1/subject', authMiddleware, subjectRoutes);
app.use('/api/v1/user', authMiddleware, userRoutes);
app.use('/api/v1/manager', authMiddleware, managerRoutes);
app.use('/api/v1/maketing', authMiddleware, maketingRoutes);
app.use('/api/v1/student', authMiddleware, studentRoutes);
app.use('/api/v1/teacher', authMiddleware, teacherRoutes);
app.use('/api/v1/tutor', authMiddleware, tutorRoutes);
app.use('/api/v1/permission', authMiddleware, permissionRoutes);
app.use('/api/v1/shift', authMiddleware, shiftRoutes);
app.use('/api/v1/salary', authMiddleware, salaryRoutes);
app.use('/api/v1/register', authMiddleware, registerRoutes);
app.use('/api/v1/lesson', authMiddleware, lessonRoutes);
app.use('/api/v1/feedback', authMiddleware, feedbackRoutes);
app.use('/api/v1/center', authMiddleware, centerRoutes);
app.use('/api/v1/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/v1/excel', authMiddleware, excelRoutes);
app.use('/api/v1/job', jobRoutes);

const s3 = new aws.S3();
const upload = multer({
	storage: multerS3({
		s3: s3,
		acl: 'public-read',
		bucket: process.env.AWS_S3_BUCKET,
	}),
});
app.post('/uploadImage', upload.single('upload'), (req, res) => {
	if (req) {
		res.status(200).json({
			uploaded: true,
			url: req.file.location,
		});
	} else {
		res.json('An unknown error occurred!');
	}
});

if (process.env.ENVIRONMENT === 'prod') {
	app.use(express.static(path.join(__dirname, 'client')));
	app.get('*', (req, res) => {
		res.sendFile(path.join(__dirname + '/client/index.html'));
	});
}

app.use(() => {
	const error = new HttpError('Could not find this route.', 404);
	throw error;
});

app.use((error, req, res, next) => {
	if (res.headersSent) {
		return next(error);
	}

	res.status(error.code || 500);
	res.json({ message: error.message || 'An unknown error occurred!' });
});

app.listen(process.env.PORT || 4000, () => {
	console.log('Listening on port 4000');
});
