import { WebRTCService } from './webrtc.service';

describe('WebRTCService (integration)', () => {
    beforeAll(() => {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;
    });
    let server: WebRTCService;
    let client: WebRTCService;

    beforeEach(() => {
        server = new WebRTCService();
        client = new WebRTCService();
    });

    afterEach(() => {
        // Clean up any connections if needed
        if (server && server.reset) server.reset();
        if (client && client.reset) client.reset();
    });

    it('should create a real offer/answer, connect, and exchange ping/pong', async () => {
        let clientReceivedPong = false;

        await new Promise<void>(async (resolve) => {
            // Server listens for messages
            server.onMessage((msg) => {
                if (msg === 'ping') {
                    server.sendMessage('pong');
                }
            });

            // Client listens for pong
            client.onMessage((msg) => {
                if (msg === 'pong') {
                    clientReceivedPong = true;
                    expect(server.isConnectionHealthy()).toBeTrue();
                    expect(client.isConnectionHealthy()).toBeTrue();
                    expect(clientReceivedPong).toBeTrue();
                    resolve();
                }
            });

            // Step 1: Server creates offer
            await server.startAsServer(async (offer) => {
                // Step 2: Client connects with offer and creates answer
                await client.connectAsClient(JSON.stringify(offer), async (answer) => {
                    // Step 3: Server processes answer
                    await server.processAnswer(JSON.stringify(answer));
                    // Step 4: Both should be connected
                    expect(server.isConnectionHealthy()).toBeTrue();
                    expect(client.isConnectionHealthy()).toBeTrue();
                    // Step 5: Client sends ping
                    client.sendMessage('ping');
                });
            });
        });
    });
});
