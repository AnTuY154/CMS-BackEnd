const validateIsString = (value) => {
	return typeof value === 'string' ? true : false;
};

const validateIsEmpty = (value) => {
	if (value === undefined || value === null) {
		return false;
	}

	if (value.toString().trim() === '') {
		return false;
	}

	return true;
};

const validateMaxLength = (str, length) => {
	return str.toString().length > length ? false : true;
};

module.exports = {
	validateIsString,
	validateIsEmpty,
	validateMaxLength,
};
