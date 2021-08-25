const pool = require('../configs/db.config');
const HttpError = require('../models/http-error');
const sendLog = require('../configs/tracking-log.config');

const getTeacherAddClassScreen = async (req, res, next) => {
	const { subject } = req.query;
	let teachers;
	try {
		let query;
		if (subject) {
			query = `Select user_id as teacher_id, full_name as teacher_name		
        from users INNER JOIN			
        teacher_subject on users.user_id = teacher_subject.teacher_id			
        where users.role_id=$1 and users.status = '1' and teacher_subject.subject_id=$2`;
			const params = ['3', subject];
			teachers = await pool.query(query, params);
		} else {
			query = `Select distinct				
            user_id as teacher_id, full_name as teacher_name		
            from users INNER JOIN			
            teacher_subject on users.user_id = teacher_subject.teacher_id			
            where users.role_id='3'`;
			teachers = await pool.query(query);
		}
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'select.controller.js',
			'getTeacherAddClassScreen'
		);
		return next(error);
	}

	return res.status(200).json(teachers.rows);
};

const getTutorAddClassScreen = async (req, res, next) => {
	const { subject } = req.query;
	let tutors;
	try {
		let query;
		if (subject) {
			query = `Select user_id as tutor_id, full_name as tutor_name		
            from users INNER JOIN			
            teacher_subject on users.user_id = teacher_subject.teacher_id			
            where users.role_id=$1 and users.status = '1' and teacher_subject.subject_id=$2`;
			const params = ['4', subject];
			tutors = await pool.query(query, params);
		} else {
			query = `Select	distinct		
            user_id as tutor_id	,full_name as tutor_name		
            from users INNER JOIN			
            teacher_subject on users.user_id = teacher_subject.teacher_id			
            where users.role_id='4'`;
			tutors = await pool.query(query);
		}
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'select.controller.js',
			'getTutorAddClassScreen'
		);
		return next(error);
	}

	return res.status(200).json(tutors.rows);
};

const getSubjectAddClassScreen = async (req, res, next) => {
	const { teacher } = req.query;
	let subjects;
	try {
		let query;
		if (teacher) {
			query = `Select subject.subject_id,subject.subject_name from 
            subject inner join teacher_subject on teacher_subject.subject_id=subject.subject_id
            where teacher_id=$1 and subject.flag=false`;
			const params = [teacher];
			subjects = await pool.query(query, params);
		} else {
			query = `Select subject_id,subject_name from subject where flag=false`;
			subjects = await pool.query(query);
		}
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'select.controller.js',
			'getSubjectAddClassScreen'
		);
		return next(error);
	}

	return res.status(200).json(subjects.rows);
};

const getRoomAddClassScreen = async (req, res, next) => {
	const { slot, startdate } = req.query;
	const day = new Date(startdate).getDay();

	let rooms;
	try {
		let query;
		if (slot) {
			query = `Select room_id,room_name from room WHERE room.flag = false`;
			rooms = await pool.query(query);
		} else {
			query = `select room_id,room_name from room WHERE room.flag = false`;
			rooms = await pool.query(query);
		}
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'select.controller.js',
			'getRoomAddClassScreen'
		);
		return next(error);
	}

	return res.status(200).json(rooms.rows);
};

const getSlotAddClassScreen = async (req, res, next) => {
	const { room, startdate } = req.query;

	const day = new Date(startdate).getDay();

	let slots;
	try {
		let query;
		if (room) {
			query = `Select slot_id,slot_name from slot where slot.type = '0' AND slot.flag = false`;
			slots = await pool.query(query);
		} else {
			query = `select slot_id,slot_name from slot where type='0' AND slot.flag = false`;
			slots = await pool.query(query);
		}
	} catch (err) {
		const error = new HttpError('Đã có lỗi xảy ra, vui lòng thử lại.', 500);
		sendLog(
			err.stack,
			error.code,
			error.message,
			'select.controller.js',
			'getSlotAddClassScreen'
		);
		return next(error);
	}

	return res.status(200).json(slots.rows);
};

module.exports = {
	getTeacherAddClassScreen,
	getTutorAddClassScreen,
	getSubjectAddClassScreen,
	getRoomAddClassScreen,
	getSlotAddClassScreen,
};
