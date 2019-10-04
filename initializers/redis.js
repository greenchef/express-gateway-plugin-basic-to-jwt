const Redis = require('ioredis');

const defaultClient = new Redis({
	port: 6379,
	host: process.env.REDIS_HOST,
	family: 4,
	db: 0
});

module.exports = {
	defaultClient,
};
