import { TestBed } from '@angular/core/testing';
import { NetworkService } from './network.service';
import { WebRTCService } from './webrtc.service';


// sudo apt-get update && sudo apt-get install -y chromium
// export CHROME_BIN=$(which chromium)
// ng test

class MockWebRTCService {
    private connectionStateCallback: (state: string) => void = () => { };
    private messageCallback: (msg: string) => void = () => { };

    deviceId = 'mock-device-id';

    onConnectionState(callback: (state: string) => void): void {
        this.connectionStateCallback = callback;
    }

    onMessage(callback: (msg: string) => void): void {
        this.messageCallback = callback;
    }

    startAsServer(callback: (offer: any) => void): Promise<void> {
        const mockOffer = { type: 'offer', sdp: 'mock-sdp' };
        callback(mockOffer);
        this.connectionStateCallback('connected');
        return Promise.resolve();
    }

    connectAsClient(offer: any, callback: (answer: any) => void): Promise<void> {
        const mockAnswer = { type: 'answer', sdp: 'mock-sdp' };
        callback(mockAnswer);
        this.connectionStateCallback('connected');
        return Promise.resolve();
    }

    processAnswer(answer: any): Promise<void> {
        this.connectionStateCallback('connected');
        return Promise.resolve();
    }

    sendMessage(msg: string): void {
        this.messageCallback(msg);
    }

    reset(): void {
        this.connectionStateCallback('not connected');
    }
}
describe('NetworkService', () => {
    let networkService: NetworkService;
    let mockWebRTCService: MockWebRTCService;

    beforeEach(() => {
        mockWebRTCService = new MockWebRTCService();

        TestBed.configureTestingModule({
            providers: [
                NetworkService,
                { provide: WebRTCService, useValue: mockWebRTCService }
            ]
        });

        networkService = TestBed.inject(NetworkService);
    });



    it('should create data channels and send messages', () => {
        const messageCallback = jasmine.createSpy('messageCallback');
        networkService.onMessage(messageCallback);

        networkService.sendMessage('ping');
        expect(messageCallback).toHaveBeenCalledWith('ping');

        mockWebRTCService.sendMessage('pong');
        expect(messageCallback).toHaveBeenCalledWith('pong');
    });
});
