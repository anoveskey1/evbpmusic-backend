const chai = require('chai');
const sinon = require('sinon');
const request = require('supertest');
const proxyquire = require('proxyquire');

const expect = chai.expect;

const mockToken = { token: 'mock-access-token' };
const getTokenStub = sinon.stub().resolves(mockToken);
const credentialStub = sinon.stub().returns({ getToken: getTokenStub });

const postStub = sinon.stub().resolves();
const graphClientStub = {
    init: () => ({
        api: () => ({
            post: (...args) => postStub(...args)
        })
    })
};

const consoleErrorStub = sinon.stub(console, 'error');

const app = proxyquire('../server', {
    '@azure/identity': { ClientSecretCredential: credentialStub },
    '@microsoft/microsoft-graph-client': { Client: graphClientStub }
});

describe('Server', () => {
    afterEach(() => {
        postStub.reset();
        postStub.resolves();
    });

    after(() => {
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
        postStub.reset();
        postStub.rejects(new Error('Failed to send email'));
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
});