// chat.js
import { callOpenAI, typeMessage, showLoader, hideLoader } from './utils.js';
import { openAIConfig, DID_API } from './config.js';

let conversationHistory = [];
// 获取DOM元素
const talkVideo = document.getElementById('talk-video');
talkVideo.setAttribute('playsinline', '');
const peerStatusLabel = document.getElementById('peer-status-label');
const iceStatusLabel = document.getElementById('ice-status-label');
const iceGatheringStatusLabel = document.getElementById('ice-gathering-status-label');
const signalingStatusLabel = document.getElementById('signaling-status-label');

// 定义全局变量
let peerConnection;
let streamId;
let sessionId;
let sessionClientAnswer;

document.getElementById('user-input-field').addEventListener('keypress', async function (e) {
    if (e.key === 'Enter') {
        const input = this.value.trim();
        if (input !== '') {
            sendMessage(input);
            this.value = '';
        }
    }
});

async function sendMessage(input) {
    const chatBox = document.getElementById('chat-box');
    displaySentMessage(input, chatBox);

    const chatResponse = await getMessageFromGPT(input);
    // 调用DID
    getMessageFromDID(chatResponse);
    displayReceivedMessage(chatResponse, chatBox);
}

function displaySentMessage(message, container) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message-sent clearfix';
    messageElement.textContent = message;
    container.appendChild(messageElement);
    container.scrollTop = container.scrollHeight;
}

function displayReceivedMessage(message, container) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message-received clearfix';
    container.appendChild(messageElement);
    typeMessage(message, messageElement);
}

async function getMessageFromGPT(userInput) {
    const chatBox = document.getElementById('chat-box');
    showLoader(chatBox);

    let chatResponse = '';
    const selectedModel = localStorage.getItem('selectedModel') || 'text-davinci-003'; // 读取模型或使用默认值
    if (selectedModel === openAIConfig.models.turbo) {
        chatResponse = await generateChatResponseTurbo(userInput, openAIConfig.models.turbo);
    } else if (selectedModel === openAIConfig.models.davinci) {
        chatResponse = await generateChatResponseDavinci(userInput, openAIConfig.models.davinci);
    } else {
        console.error('No model selected');
        hideLoader(chatBox);
        return;
    }

    hideLoader(chatBox);
    return chatResponse;
}

async function generateChatResponseTurbo(userInput, model) {
    const apiUrl = openAIConfig.getChatEndpoint(model);
    conversationHistory.push({ role: "user", content: userInput });

    console.log("model=========", model)
    const data = {
        model: model, // 使用传入的模型值
        messages: conversationHistory
    };

    const responseData = await callOpenAI(apiUrl, data);
    return responseData ? responseData.choices[0].message.content : `I'm sorry, I wasn't able to process that.`;
}

async function generateChatResponseDavinci(userInput, model) {
    const apiUrl = openAIConfig.getChatEndpoint(model);

    let conversation = conversationHistory.map(entry => `${entry.role}: ${entry.content}`).join('\n');
    conversation += `\nUser: ${userInput}\nAI:`;

    const data = {
        prompt: conversation,
        max_tokens: 2000,
        stop: ["\n", "User:", "AI:"],
        temperature: 0.5,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
    };

    const responseData = await callOpenAI(apiUrl, data);
    if (responseData) {
        const aiText = responseData.choices[0].text.trim();
        conversationHistory.push({ role: "ai", content: aiText });
        return aiText;
    } else {
        return `I'm sorry, I wasn't able to process that.`;
    }
}

async function getMessageFromDID(chatResponse){
    const talkResponse = await fetch(`${DID_API.url}/talks/streams/${streamId}`, {
        method: 'POST',
        headers: { Authorization: `Basic ${DID_API.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            script: {
                type: 'text',
                subtitles: 'false',
                /**
                 * 中文：zh-cn-XiaomoNeural
                 * 粤语：zh-HK-HiuMaanNeural
                 */
                provider: { type: 'microsoft', voice_id: localStorage.getItem('selectedVoiceId'), voice_config: { style: localStorage.getItem('selectedStyle')}},
                ssml: true,
                input: chatResponse, // Use the GPT-3 response as the input value
            },
            config: {
                fluent: true,
                pad_audio: 0,
                driver_expressions: {
                    expressions: [{ expression: localStorage.getItem('selectedEmotion'), start_frame: 0, intensity: localStorage.getItem('selectedIntensity') }],
                    transition_frames: 0
                },
                align_driver: true,
                align_expand_factor: 0,
                auto_match: true,
                motion_factor: 0,
                normalization_factor: 0,
                sharpen: true,
                stitch: true,
                result_format: 'mp4'
            },
            // 必须的
            'config': {
                'stitch': true,
            },
            // driver_url	描述
            // bank://nostalgia	温柔和的缓慢运动
            // bank://fun	时髦的运动与有趣的脸部表情
            // bank://dance	跳舞头动作
            // bank://classics	唱运动|作出一定要设置 "mute": false
            // bank://subtle	细微的动作|工作最多的面孔，彼此靠近在一个单一的图像
            // bank://stitch	最好的作品时 "stitch": true

            'driver_url': 'bank://lively/',
            'session_id': sessionId,
        }),
    });
}

// 连接按钮点击事件处理函数
const connectButton = document.getElementById('connect-button');
connectButton.onclick = async () => {
    // 如果已经连接，则不执行任何操作。
    if (peerConnection && peerConnection.connectionState === 'connected') {
        return;
    }
    // 从connectButton的data属性中获取source_url
    const sourceUrl = connectButton.getAttribute('data-source-url') || "https://file.pccwhq.com/flame/china-avc.png";

    // 停止所有流并关闭现有的peer连接。
    stopAllStreams();
    closePC();

    // 创建新的会话并获取流ID、offer、ICE服务器和会话ID。
    const sessionResponse = await fetch(`${DID_API.url}/talks/streams`, {
        method: 'POST',
        headers: {'Authorization': `Basic ${DID_API.key}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({
            source_url: sourceUrl // 使用选中的演示者的poster URL
        }),
    });



    const { id: newStreamId, offer, ice_servers: iceServers, session_id: newSessionId } = await sessionResponse.json()
    streamId = newStreamId;
    sessionId = newSessionId;

    try {
        sessionClientAnswer = await createPeerConnection(offer, iceServers);
    } catch (e) {
        console.log('error during streaming setup', e);
        stopAllStreams();
        closePC();
        return;
    }

    const sdpResponse = await fetch(`${DID_API.url}/talks/streams/${streamId}/sdp`,
        {
            method: 'POST',
            headers: {Authorization: `Basic ${DID_API.key}`, 'Content-Type': 'application/json'},
            body: JSON.stringify({answer: sessionClientAnswer, session_id: sessionId})
        });
};

// ICE收集状态变化的回调函数
function onIceGatheringStateChange() {
    // 更新状态显示
    iceGatheringStatusLabel.innerText = peerConnection.iceGatheringState;
    iceGatheringStatusLabel.className = 'iceGatheringState-' + peerConnection.iceGatheringState;
}

// ICE候选处理的回调函数
function onIceCandidate(event) {
    // 将ICE候选发送到服务器
    console.log('onIceCandidate', event);
    if (event.candidate) {
        const { candidate, sdpMid, sdpMLineIndex } = event.candidate;

        fetch(`${DID_API.url}/talks/streams/${streamId}/ice`,
            {
                method: 'POST',
                headers: {Authorization: `Basic ${DID_API.key}`, 'Content-Type': 'application/json'},
                body: JSON.stringify({ candidate, sdpMid, sdpMLineIndex, session_id: sessionId})
            });
    }
}

// ICE连接状态变化的回调函数
function onIceConnectionStateChange() {
    // 更新状态显示并处理失败或关闭的状态
    iceStatusLabel.innerText = peerConnection.iceConnectionState;
    iceStatusLabel.className = 'iceConnectionState-' + peerConnection.iceConnectionState;
    if (peerConnection.iceConnectionState === 'failed' || peerConnection.iceConnectionState === 'closed') {
        stopAllStreams();
        closePC();
    }
}

// 连接状态变化的回调函数
function onConnectionStateChange() {
    // 更新状态显示
    // not supported in firefox
    peerStatusLabel.innerText = peerConnection.connectionState;
    peerStatusLabel.className = 'peerConnectionState-' + peerConnection.connectionState;
}

// 信号状态变化的回调函数
function onSignalingStateChange() {
    // 更新状态显示
    signalingStatusLabel.innerText = peerConnection.signalingState;
    signalingStatusLabel.className = 'signalingState-' + peerConnection.signalingState;
}

// Track事件的回调函数
function onTrack(event) {
    // 将接收到的流设置到video元素上
    const remoteStream = event.streams[0];
    setVideoElement(remoteStream);
}

// 创建peer connection并设置远程和本地描述
async function createPeerConnection(offer, iceServers) {
    // 创建peer connection，监听各种状态变化事件
    if (!peerConnection) {
        peerConnection = new RTCPeerConnection({iceServers});
        peerConnection.addEventListener('icegatheringstatechange', onIceGatheringStateChange, true);
        peerConnection.addEventListener('icecandidate', onIceCandidate, true);
        peerConnection.addEventListener('iceconnectionstatechange', onIceConnectionStateChange, true);
        peerConnection.addEventListener('connectionstatechange', onConnectionStateChange, true);
        peerConnection.addEventListener('signalingstatechange', onSignalingStateChange, true);
        peerConnection.addEventListener('track', onTrack, true);
    }

    await peerConnection.setRemoteDescription(offer);
    console.log('set remote sdp OK');

    const sessionClientAnswer = await peerConnection.createAnswer();
    console.log('create local sdp OK');

    await peerConnection.setLocalDescription(sessionClientAnswer);
    console.log('set local sdp OK');

    return sessionClientAnswer;
}

// 将流设置到video元素的函数
function setVideoElement(stream) {
    // 如果流存在，则设置到video元素上
    if (!stream) return;
    talkVideo.srcObject = stream;

    // safari hotfix
    if (talkVideo.paused) {
        talkVideo.play().then(_ => {}).catch(e => {});
    }
}

// 停止所有流的函数
function stopAllStreams() {
    // 停止video元素的所有流
    if (talkVideo.srcObject) {
        console.log('stopping video streams');
        talkVideo.srcObject.getTracks().forEach(track => track.stop());
        talkVideo.srcObject = null;
    }
}

// 关闭peer connection的函数

function closePC(pc = peerConnection) {
    // 关闭peer connection并移除所有事件监听器
    if (!pc) return;
    console.log('stopping peer connection');
    pc.close();
    pc.removeEventListener('icegatheringstatechange', onIceGatheringStateChange, true);
    pc.removeEventListener('icecandidate', onIceCandidate, true);
    pc.removeEventListener('iceconnectionstatechange', onIceConnectionStateChange, true);
    pc.removeEventListener('connectionstatechange', onConnectionStateChange, true);
    pc.removeEventListener('signalingstatechange', onSignalingStateChange, true);
    pc.removeEventListener('track', onTrack, true);
    iceGatheringStatusLabel.innerText = '';
    signalingStatusLabel.innerText = '';
    iceStatusLabel.innerText = '';
    peerStatusLabel.innerText = '';
    console.log('stopped peer connection');
    if (pc === peerConnection) {
        peerConnection = null;
    }
}


// 导出相关函数以便在其他模块中使用
export { sendMessage, getMessageFromGPT };

