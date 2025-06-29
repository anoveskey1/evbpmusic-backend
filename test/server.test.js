const chai = require('chai');
const fs = require('fs');
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
const fsStub = {
    existsSync: sinon.stub().returns(true),
    readFileSync: sinon.stub(),
    writeFileSync: sinon.stub()
};

const consoleErrorStub = sinon.stub(console, 'error');

proxyquire.noCallThru();

const getGuestbookEntries = proxyquire('../functions/getGuestbookEntries', { fs: fsStub });

const app = proxyquire('../server', {
    '@azure/identity': { ClientSecretCredential: credentialStub },
    '@microsoft/microsoft-graph-client': { Client: graphClientStub },
    fs: fsStub,
    './functions/getGuestbookEntries': getGuestbookEntries
});

describe('Server', () => {
    beforeEach(() => {
        fsStub.existsSync.reset();
        fsStub.readFileSync.reset();
        fsStub.writeFileSync.reset();
    });

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

    it('should have all routes registered', () => {
            const routes = app._router.stack
            .filter(r => r.route)
            .map(r => r.route.path);

            expect(routes).to.include('/');
            expect(routes).to.include('/api/guestbook-entries');
            expect(routes).to.include('/api/visitor-count');
            expect(routes).to.include('/api/send-email');
            expect(routes).to.include('/api/send-validation-code-to-email');
            expect(routes).to.include('/api/sign-guestbook');
            expect(routes).to.include('/api/validate-user');
        });

    describe('GET /api/guestbook-entries', () => {
        // beforeEach(() => {
        //     fsStub.existsSync.reset();
        //     fsStub.readFileSync.reset();
        //     fsStub.writeFileSync.reset();
        // });
        it('should return guestbook entries on GET /api/guestbook-entries', async () => {
            const mockEntries = [{ username: 'Test_User2', message: 'First!'}, { username: 'Test_User', message: 'Hello World' }];
            fsStub.existsSync.returns(true);
            fsStub.readFileSync.callsFake(() => JSON.stringify(mockEntries));

            const res = await request(app).get('/api/guestbook-entries');
            expect(res.status).to.equal(200);
            expect(res.body).to.be.an('array');
        });

        it('should return 404 status on GET /api/guestbook-entries when guestbook entries file is empty', async () => {
            fsStub.existsSync.returns(true);
            fsStub.readFileSync.callsFake(() => JSON.stringify([]));

            const res = await request(app).get('/api/guestbook-entries');
            expect(res.body).to.be.an('object');
            expect(res.status).to.equal(404);
            // expect(res.body).to.be.an('object');
        });
    });

    describe('POST /api/send-email', () =>{
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
    });

    describe('POST /api/send-validation-code-to-email', () => {
        it('should return 400 error on POST /api/send-validation-code-to-email when no data is sent', async () => {
            const res = await request(app).post('/api/send-validation-code-to-email').send({});
            expect(res.status).to.equal(400);
            expect(res.body).to.have.property('error', 'Missing required fields.');
        });

        it("should return a 400 error on POST /api/send-validation-code-to-email when email or username already exists", async () => {
            fsStub.existsSync.returns(true);
            fsStub.readFileSync.callsFake(() => JSON.stringify(
                { 'mockhash12345': { email: 'johndoe@mocksite.com', username: 'user1' }}
            ));

            const res = await request(app).post('/api/send-validation-code-to-email').send({
                email: 'johndoe@mocksite.com',
                username: 'user2' // validating that the check will happen on either or both fields
            });

            expect(res.status).to.equal(400);
            expect(res.body).to.have.property('code', 'USER_ALREADY_EXISTS');
            expect(res.body).to.have.property('message', 'Everybody gets one. If you feel you have reached this message in error, please contact us - include your email and username - and we\'ll see what we can do to help!');
        });

        it('should write a new user to the users file on POST /api/send-validation-code-to-email', async () => {
            fsStub.existsSync.returns(true);
            fsStub.readFileSync.callsFake(() => JSON.stringify({}));
            fsStub.writeFileSync.resetHistory();

            const res = await request(app).post('/api/send-validation-code-to-email').send({
                email: 'johndoe@mocksite.com',
                username: 'user1'
            });
            expect(res.status).to.equal(200);
            expect(fsStub.writeFileSync.calledOnce).to.be.true;
            const writtenData = JSON.parse(fsStub.writeFileSync.getCall(0).args[1]);
        });

        it('should send an email with the validation code on POST /api/send-validation-code-to-email', async () => {
            fsStub.existsSync.returns(true);
            fsStub.readFileSync.callsFake(() => JSON.stringify({}));
            fsStub.writeFileSync.resetHistory();
            postStub.resetHistory();

            const res = await request(app).post('/api/send-validation-code-to-email').send({
                email: 'johndoe@mocksite.com',
                username: 'user1'
            });
            expect(res.status).to.equal(200);
            expect(postStub.calledOnce).to.be.true;
            const emailArgs = postStub.getCall(0).args[0];
            expect(emailArgs).to.have.property('message');
            expect(emailArgs.message).to.have.property('body');
            expect(emailArgs.message.body.contentType).to.equal('Text');
            expect(emailArgs.message.body.content).to.include('Your validation code is:');
            expect(res.body.message).to.equal('A validation code has been sent to the email address you provided. Please enter it into the validation code input field to continue.');
        });
    });

    describe('POST /api/sign-guestbook', () => {
        it('should write a new entry to the guestbook on POST /api/sign-guestbook', async () => {
            fsStub.existsSync.returns(true);
            fsStub.readFileSync.callsFake(() => JSON.stringify([]));
            fsStub.writeFileSync.resetHistory();

            const res = await request(app).post('/api/sign-guestbook').send({
                username: 'Test_User',
                message: 'Hello World',
                validationCode: 'valid-code'
            });
            expect(res.status).to.equal(201);
            expect(fsStub.writeFileSync.calledOnce).to.be.true;
            const writtenData = JSON.parse(fsStub.writeFileSync.getCall(0).args[1]);
            expect(writtenData).to.be.an('array');
            expect(writtenData[0]).to.have.property('username', 'Test_User');
            expect(writtenData[0]).to.have.property('message', 'Hello World');
        });
    });

    describe('POST /api/validate-user', () => {
        it('should return 401 error on POST /api/validate-user when user entry is not found', async () => {
            fsStub.existsSync.returns(true);
            fsStub.readFileSync.callsFake(() => JSON.stringify({}));

            const res = await request(app).post('/api/validate-user').send({
                validationCode: 'nonexistent-code'
            });
            expect(res.status).to.equal(401);
            expect(res.body).to.have.property('code', 'USER_ENTRY_NOT_FOUND');
        });

        it('should return 200 status on POST /api/validate-user with valid validation code', async () => {
            fsStub.existsSync.returns(true);
            fsStub.readFileSync.callsFake(() => JSON.stringify({
                'valid-code': { username: 'Test_User', email: 'johndoe@mocksite.com' }
            }));

        });
    });

    describe('GET /api/visitor-count', () => {
        it('should return a visitor count on GET /api/visitor-count', async () => {
        const res = await request(app).get('/api/visitor-count');
        expect(res.status).to.equal(200);
        expect(res.body).to.have.property('count');
    });
    });
});