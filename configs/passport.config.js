require('dotenv').config();
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const pool = require('./db.config');
const { validPassword } = require('../common/function');

passport.use(
	'local',
	new LocalStrategy(
		{
			usernameField: 'username',
			passwordField: 'password',
		},
		async (username, password, done) => {
			let user;
			try {
				const query = `SELECT user_id, username, role_id, password FROM users WHERE (LOWER(username) = $1 OR LOWER(email) = $2) AND status = '1' AND is_confirm = true LIMIT 1`;
				const params = [username.toLowerCase(), username.toLowerCase()];
				user = await pool.query(query, params);

				if (user.rowCount === 0) {
					return done(null, false);
				}

				const checkPassword = await validPassword(
					password,
					user.rows[0].password
				);

				if (!checkPassword) {
					return done(null, false);
				}

				const updateQuery =
					'UPDATE users SET last_login = $1 WHERE user_id = $2';
				const updateParams = [new Date(), user.rows[0].user_id];
				await pool.query(updateQuery, updateParams);
			} catch (error) {
				return done(error);
			}

			const values = {
				userId: user.rows[0].user_id,
				role: user.rows[0].role_id,
			};

			return done(null, values);
		}
	)
);

module.exports = passport;
