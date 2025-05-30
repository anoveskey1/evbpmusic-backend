const chai = require('chai');
const nodemailer = require('nodemailer');
const sinon = require('sinon');
const request = require('supertest');

const app = require('../server');

const expect = chai.expect;

describe('Server', () => {
    let createTransportStub;
    let consoleErrorStub;

    beforeEach(() => {
        createTransportStub = sinon.stub(nodemailer, 'createTransport').returns({
            sendMail: (opts, cb) => cb(null, { response: 'mocked' })
        });
        consoleErrorStub = sinon.stub(console, 'error');
    });

    afterEach(() => {
        nodemailer.createTransport.restore();
        consoleErrorStub.restore();
    });

    it('should respond with a message on GET /', async () => {
        const res = await request(app).get('/');

        expect(res.status).to.equal(200);
        expect(res.text).to.equal('There is nothing to see here. Perhaps you meant to visit the frontend?');
    });
    
    it('should return a fail message on POST /api/send-email when no data is sent', async () => {
        const res = await request(app).post('/api/send-email').send({});

        expect(res.status).to.equal(400);
        expect(res.body).to.have.property('error', 'Missing required fields.');
    });

    it('should return a 500 error on POST /api/send-email when email sending fails', async () => {
        createTransportStub.restore();
        createTransportStub = sinon.stub(nodemailer, 'createTransport').returns({
            sendMail: (opts, cb) => cb(new Error('Failed to send email'))
        });

        const res = await request(app)
        .post('/api/send-email')
        .send({ email: 'somedude@awebsite.com', message: 'Hello!', subject: 'Test' });

        expect(res.status).to.equal(500);
        expect(res.body).to.have.property('error', 'Failed to send email');
    });
    
    it('should return a visitor count on GET /api/visitor-count', async () => {
        const res = await request(app).get('/api/visitor-count');
            
        expect(res.status).to.equal(200);
        expect(res.body).to.have.property('count');
    });

    it('should block requests from disallowed origins', async () => {
        const res = await request(app)
            .get('/')
            .set('Origin', 'http://notallowed.com');
        expect(res.status).to.equal(500);
        expect(res.headers['access-control-allow-origin']).to.be.undefined;
    });
});