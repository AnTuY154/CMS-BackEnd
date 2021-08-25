require('dotenv').config();
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;

const oauth2Client = new OAuth2(
	process.env.GOOGLE_CLIENT_ID,
	process.env.GOOGLE_SERCRET_KEY,
	'https://developers.google.com/oauthplayground'
);

oauth2Client.setCredentials({
	refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const accessToken = oauth2Client.getAccessToken();

const transporter = nodemailer.createTransport({
	host: 'smtp.gmail.com',
	port: process.env.ENVIRONMENT === 'dev' ? 587 : 465,
	secure: process.env.ENVIRONMENT === 'dev' ? false : true,
	auth: {
		type: 'OAuth2',
		user: 'xoaiacademy@gmail.com',
		clientId: process.env.GOOGLE_CLIENT_ID,
		clientSecret: process.env.GOOGLE_SERCRET_KEY,
		refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
		accessToken: accessToken,
	},
	tls: {
		rejectUnauthorized: false,
	},
});

module.exports = transporter;
