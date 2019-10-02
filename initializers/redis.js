const Redis = require('ioredis');
const moment = require('moment');

const defaultClient = new Redis({
	port: 6379,
	host: process.env.REDIS_HOST,
	family: 4,
	db: 0
});

const redisHelper = {
	getExpireTimeInSeconds: (momentAmount, momentUnit) => {
		const keepUntilDate = moment().add(momentAmount, momentUnit);
		const duration = moment.duration(keepUntilDate.diff(moment()));
		return duration.asSeconds();
	}
};

module.exports = {
	defaultClient,
	redisHelper
};
