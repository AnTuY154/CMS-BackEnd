const bcrypt = require('bcrypt');
const pool = require('../configs/db.config');
const HttpError = require('../models/http-error');
const sendLog = require('../configs/tracking-log.config');

const generateDefaultPassword = async () => {
	const salt = await bcrypt.genSalt(10);
	const hashPassword = await bcrypt.hash('123123asd', salt);

	return hashPassword;
};

const generateHash = async (password) => {
	const salt = await bcrypt.genSalt(10);
	const hashPassword = await bcrypt.hash(password, salt);

	return hashPassword;
};

const validPassword = async (password, hash) => {
	const checkValid = await bcrypt.compare(password, hash);

	return checkValid;
};

const autoGenerateUsername = (fullname) => {
	const split = fullname
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/đ/g, 'd')
		.replace(/Đ/g, 'D')
		.trim()
		.replace(/\s\s+/g, ' ')
		.toLowerCase()
		.split(' ');

	let result = split[split.length - 1];
	for (let i = 0; i < split.length - 1; i++) {
		result += split[i].charAt(0);
	}

	return (
		result +
		(Math.floor(Math.random() * (1000000 - 100000)) + 100000)
	).toString();
};

const getDays = (startdate, day, enddate) => {
	let d1 = new Date(startdate);
	let d2 = new Date(enddate);
	let days = [];

	while (d1.getDay() !== day) {
		d1.setDate(d1.getDate() + 1);
	}

	while (d1 <= d2) {
		days.push(new Date(d1.getTime()));
		d1.setDate(d1.getDate() + 7);
	}
	return days;
};

const checkRole = async (role, functionCode) => {
	let check;
	try {
		const query = `SELECT function.function_id FROM function INNER JOIN permission on function.function_id = permission.function_id
        where role_id=$1 and function.function_id = $2 and permission.is_permiss = true LIMIT 1`;
		const param = [role, functionCode];
		check = await pool.query(query, param);
	} catch (err) {
		const error = new HttpError('Đã xảy ra lỗi, vui lòng thử lại.', 500);
		sendLog(err.stack, error.code, error.message, 'function.js', 'checkRole');
		return false;
	}

	if (check.rowCount < 1) {
		return false;
	}

	return true;
};

const checkDayBelongWeek = (thisdate) => {
	const d = new Date(`${new Date().getFullYear()}-01-01`);
	const month = 0;
	let mondays = '';

	d.setDate(1);

	while (d.getDay() !== 1) {
		d.setDate(d.getDate() + 1);
	}

	if (d.getMonth() === month) {
		mondays = new Date(d.getTime());
	}

	let temp = new Date(mondays);
	let count = 0;
	while (temp < new Date(`${new Date().getFullYear()}-12-31`)) {
		const monday = new Date(temp.getTime());
		const sunday = new Date(temp.setDate(temp.getDate() + 6));

		if (
			monday.getTime() <= new Date(thisdate).getTime() &&
			new Date(thisdate).getTime() <= sunday.getTime()
		) {
			return count;
		}
		count++;
		temp.setDate(temp.getDate() + 1);
	}

	return count;
};

module.exports = {
	generateDefaultPassword,
	generateHash,
	validPassword,
	autoGenerateUsername,
	getDays,
	checkRole,
	checkDayBelongWeek,
};
