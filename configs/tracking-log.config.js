require('dotenv').config();
const axios = require('axios').default;

const sendLog = async (stack, code, message, file, api) => {
	if (process.env.ENVIRONMENT == 'dev') {
		return;
	}
	const data = {
		attachments: [
			{
				fallback: 'Required plain-text summary of the attachment.',
				color: '#36a64f',
				pretext: 'Lại lỗi rồi <!channel>',
				text: `${stack} \n Error code: *${code}* \n Error message: *${message}* \n File: *${file}* \n Api: *${api}*`,
				footer: 'Tracking Bot',
				footer_icon:
					'https://platform.slack-edge.com/img/default_application_icon.png',
				ts: Date.now(),
			},
		],
	};

	await axios({
		method: 'POST',
		url: 'https://hooks.slack.com/services/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',
		headers: {
			'Content-Type': 'application/json',
		},
		data: data,
	});
};

module.exports = sendLog;
