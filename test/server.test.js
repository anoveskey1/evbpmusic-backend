const chai = require('chai');
const fs = require('fs');
const sinon = require('sinon');
const request = require('supertest');
const proxyquire = require('proxyquire');
const expect = chai.expect;

// mock data
const mockToken = { token: 'mock-access-token' };
const mockGuestbookUser = {
    email: 'johndoe@mocksite.com', 
    username: 'user1'
};

// stubs
const consoleErrorStub = sinon.stub(console, 'error');
const getTokenStub = sinon.stub().resolves(mockToken);
const credentialStub = sinon.stub().returns({ getToken: getTokenStub });
const fsStub = {
    existsSync: sinon.stub().returns(true),
    readFileSync: sinon.stub(),
    writeFileSync: sinon.stub()
};
const graphClientStub = {
    init: () => ({
        api: () => ({
            post: (...args) => postStub(...args)
        })
    })
};
const postStub = sinon.stub().resolves();

proxyquire.noCallThru();

// proxyquire functions
const getGuestbookEntries = proxyquire('../functions/getGuestbookEntries', { fs: fsStub });
const sendEmail = proxyquire('../functions/sendEmail', { 
    '@azure/identity': { ClientSecretCredential: credentialStub },
    '@microsoft/microsoft-graph-client': { Client: graphClientStub} 
});
const sendValidationCodeToEmail = proxyquire('../functions/sendValidationCodeToEmail', {
    fs: fsStub,
    '@azure/identity': { ClientSecretCredential: credentialStub },
    '@microsoft/microsoft-graph-client': { Client: graphClientStub }
});
const signGuestbook = proxyquire('../functions/signGuestbook', { fs: fsStub });
const validateUser = proxyquire('../functions/validateUser', { fs: fsStub });

const app = proxyquire('../server', {
    '@azure/identity': { ClientSecretCredential: credentialStub },
    '@microsoft/microsoft-graph-client': { Client: graphClientStub },
    fs: fsStub,
    './functions/getGuestbookEntries': getGuestbookEntries,
    './functions/sendEmail': sendEmail,
    './functions/sendValidationCodeToEmail': sendValidationCodeToEmail,
    './functions/signGuestbook': signGuestbook,
    './functions/validateUser': validateUser
});

// testing helper functions
const fsStubSetup = (readFileReturns) => {
    fsStub.existsSync.returns(true);
    fsStub.readFileSync.callsFake(() => JSON.stringify(readFileReturns));
    fsStub.writeFileSync.resetHistory();
}

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
        const response = await request(app).get('/');
        expect(response.status).to.equal(200);
        expect(response.text).to.equal('There is nothing to see here. Perhaps you meant to visit the frontend?');
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
        it('should return guestbook entries on GET /api/guestbook-entries', async () => {
            const mockEntries = [{ username: 'Test_User2', message: 'First!'}, { username: 'Test_User', message: 'Hello World' }];
            fsStubSetup(mockEntries);

            const response = await request(app).get('/api/guestbook-entries');
            expect(response.status).to.equal(200);
            expect(response.body).to.be.an('array');
        });

        it('should return 404 status on GET /api/guestbook-entries when guestbook entries file is empty', async () => {
            fsStubSetup([]);

            const response = await request(app).get('/api/guestbook-entries');
            expect(response.body).to.be.an('object');
            expect(response.status).to.equal(404);
        });
    });

    describe('POST /api/send-email', () =>{
        it('should return a fail message on POST /api/send-email when no data is sent', async () => {
        const response = await request(app).post('/api/send-email').send({});
        expect(response.status).to.equal(400);
        expect(response.body).to.have.property('error', 'Missing required fields.');
    });

    it('should return a 500 error on POST /api/send-email when email sending fails', async () => {
        postStub.reset();
        postStub.rejects(new Error('Failed to send email'));
        const response = await request(app)
            .post('/api/send-email')
            .send({ email: 'somedude@awebsite.com', message: 'Hello!', subject: 'Test' });
        expect(response.status).to.equal(500);
        expect(response.body).to.have.property('error', 'Failed to send email');
    });
    });

    describe('POST /api/send-validation-code-to-email', () => {
        it('should return 400 error on POST /api/send-validation-code-to-email when no data is sent', async () => {
            const response = await request(app).post('/api/send-validation-code-to-email').send({});
            expect(response.status).to.equal(400);
            expect(response.body).to.have.property('error', 'Missing required fields.');
        });

        it("should return a 400 error on POST /api/send-validation-code-to-email when email or username already exists", async () => {
            fsStubSetup({ 'mockhash12345': mockGuestbookUser });

            const response = await request(app).post('/api/send-validation-code-to-email').send({
                ...mockGuestbookUser,
                username: 'user2' // validating that the check will happen on either or both fields
            });

            expect(response.status).to.equal(400);
            expect(response.body).to.have.property('code', 'USER_ALREADY_EXISTS');
            expect(response.body).to.have.property('message', 'Everybody gets one. If you feel you have reached this message in error, please contact us - include your email and username - and we\'ll see what we can do to help!');
        });

        it('should write a new user to the users file on POST /api/send-validation-code-to-email', async () => {
            fsStubSetup({});

            const response = await request(app).post('/api/send-validation-code-to-email').send(mockGuestbookUser);
            expect(response.status).to.equal(200);
            expect(fsStub.writeFileSync.calledOnce).to.be.true;
            const writtenData = JSON.parse(fsStub.writeFileSync.getCall(0).args[1]);
        });

        it('should send an email with the validation code on POST /api/send-validation-code-to-email', async () => {
            fsStubSetup({});
            postStub.resetHistory();

            const response = await request(app).post('/api/send-validation-code-to-email').send(mockGuestbookUser);
            expect(response.status).to.equal(200);
            expect(postStub.calledOnce).to.be.true;
            const emailArgs = postStub.getCall(0).args[0];
            expect(emailArgs).to.have.property('message');
            expect(emailArgs.message).to.have.property('body');
            expect(emailArgs.message.body.contentType).to.equal('Text');
            expect(emailArgs.message.body.content).to.include('Your validation code is:');
            expect(response.body.message).to.equal('A validation code has been sent to the email address you provided. Please enter it into the validation code input field to continue.');
        });
    });

    describe('POST /api/sign-guestbook', () => {
        it('should write a new entry to the guestbook on POST /api/sign-guestbook', async () => {
            fsStubSetup([]);

            const response = await request(app).post('/api/sign-guestbook').send({
                username: 'Test_User',
                message: 'Hello World',
                validationCode: 'valid-code'
            });
            expect(response.status).to.equal(201);
            expect(fsStub.writeFileSync.calledOnce).to.be.true;
            const writtenData = JSON.parse(fsStub.writeFileSync.getCall(0).args[1]);
            expect(writtenData).to.be.an('array');
            expect(writtenData[0]).to.have.property('username', 'Test_User');
            expect(writtenData[0]).to.have.property('message', 'Hello World');
        });
    });

    describe('POST /api/validate-user', () => {
        it('should return 401 error on POST /api/validate-user when user entry is not found', async () => {
            fsStubSetup({});

            const response = await request(app).post('/api/validate-user').send({
                validationCode: 'nonexistent-code'
            });
            expect(response.status).to.equal(401);
            expect(response.body).to.have.property('code', 'USER_ENTRY_NOT_FOUND');
        });

        it('should return 200 status on POST /api/validate-user with valid validation code', async () => {
            fsStubSetup({ 'valid-code': mockGuestbookUser });

            const response = await request(app).post('/api/validate-user').send({
                validationCode: 'valid-code'
            });
            expect(response.status).to.equal(200);
            expect(response.body).to.have.property('message', 'User validation successful. You can now sign the guestbook!');
        });
    });

    describe('GET /api/visitor-count', () => {
        it('should return a visitor count on GET /api/visitor-count', async () => {
        const response = await request(app).get('/api/visitor-count');
        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('count');
    });
    });
});