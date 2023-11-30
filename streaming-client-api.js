//Edit by Fang Wang on Oct 17 2023
'use strict';

import DID_API from './api.json' assert { type: 'json' };
if (DID_API.key == '🤫') alert('Please put your api key inside ./api.json and restart..')

const RTCPeerConnection = (window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection).bind(window);

let peerConnection;
let streamId;
let sessionId;
let sessionClientAnswer;


const talkVideo = document.getElementById('talk-video');
talkVideo.setAttribute('playsinline', '');
const peerStatusLabel = document.getElementById('peer-status-label');
const iceStatusLabel = document.getElementById('ice-status-label');
const iceGatheringStatusLabel = document.getElementById('ice-gathering-status-label');
const signalingStatusLabel = document.getElementById('signaling-status-label');

const connectButton = document.getElementById('connect-button');
connectButton.onclick = async () => {
  if (peerConnection && peerConnection.connectionState === 'connected') {
    return;
  }

  stopAllStreams();
  closePC();

  const sessionResponse = await fetch(`${DID_API.url}/talks/streams`, {
    method: 'POST',
    headers: {'Authorization': `Basic ${DID_API.key}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      source_url: "https://file.pccwhq.com/flame/china-avc.png"
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

document.getElementById("triangle-button").addEventListener("click", function() {
  var drawer = document.getElementById("drawer");
  if (drawer.style.right === "-250px") {
    drawer.style.right = "0";
  } else {
    drawer.style.right = "-250px";
  }
});
document.getElementById('user-input-field').addEventListener('keypress', async function (e) {
  if (e.key === 'Enter') {
    var input = this.value;
    if (input.trim() !== '') {
      var chatBox = document.getElementById('chat-box');
      var newMessage = document.createElement('div');
      newMessage.className = 'message-sent clearfix';
      newMessage.textContent = input; // 更安全的文本赋值方法
      chatBox.appendChild(newMessage); // 添加新消息元素
      this.value = '';
      chatBox.scrollTop = chatBox.scrollHeight;

      // 异步获取 GPT-3 的响应
      await getMessageFromGPT(input);
    }
  }
});


// const talkButton = document.getElementById('talk-button');

// 假设有一个全局变量来保存对话历史
let conversationHistory = '';

async function generateChatResponse(userInput) {
  const apiUrl = 'https://api.openai.com/v1/engines/text-davinci-003/completions';
  const apiKey = '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'; // 请确保使用自己的 API 密钥，并且不要公开暴露
  const settings = {
    max_tokens: 4000,
    temperature: 0.5,
    top_p: 1,
    stop: ['\n'],
  }
  // 将用户输入添加到对话历史中，确保在每次请求之间维持上下文
  conversationHistory += `User: ${userInput}\nAI:`;

  const data = {
    prompt: conversationHistory,
    max_tokens: settings.max_tokens || 150, // 默认值
    temperature: settings.temperature || 0.7, // 控制结果的随机性
    top_p: settings.top_p || 1, // 控制采样的多样性
    frequency_penalty: settings.frequency_penalty || 0, // 减少重复
    presence_penalty: settings.presence_penalty || 0, // 提高新颖性
    stop: settings.stop || ["\n", " User:", " AI:"], // 停止符
    // 如果需要，可以添加更多参数
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();

    // 添加 AI 的响应到对话历史中
    const aiText = responseData.choices[0].text;
    conversationHistory += aiText + '\n';

    return aiText;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return `I'm sorry, I wasn't able to process that.`;
  }
}


talkButton.onclick = async () => {
  if (peerConnection?.signalingState === 'stable' || peerConnection?.iceConnectionState === 'connected') {
    // Get the user input from the text input field
    const userInput = document.getElementById('user-input-field').value;

    // Use OpenAI's GPT-3 to generate a response
    const chatResponse = await generateChatResponse(userInput);

    // const talkResponse = await fetch(`${DID_API.url}/talks/streams/${streamId}`, {
    //   method: 'POST',
    //   headers: { Authorization: `Basic ${DID_API.key}`, 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     script: {
    //       type: 'text',
    //       subtitles: 'false',
    //       provider: { type: 'microsoft', voice_id: 'zh-cn-XiaomoNeural' },
    //       ssml: true,
    //       input: chatResponse, // Use the GPT-3 response as the input value
    //     },
    //     config: {
    //       fluent: true,
    //       pad_audio: 0,
    //       driver_expressions: {
    //         expressions: [{ expression: 'neutral', start_frame: 0, intensity: 0 }],
    //         transition_frames: 0,
    //       },
    //       align_driver: true,
    //       align_expand_factor: 0,
    //       auto_match: true,
    //       motion_factor: 0,
    //       normalization_factor: 0,
    //       sharpen: true,
    //       stitch: true,
    //       result_format: 'mp4',
    //     },
    //     'driver_url': 'bank://lively/',
    //     'config': {
    //       'stitch': true,
    //     },
    //     'session_id': sessionId,
    //   }),
    // });
  }
};


// //################################

const destroyButton = document.getElementById('destroy-button');
destroyButton.onclick = async () => {
  await fetch(`${DID_API.url}/talks/streams/${streamId}`,
    {
      method: 'DELETE',
      headers: {Authorization: `Basic ${DID_API.key}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({session_id: sessionId})
    });

  stopAllStreams();
  closePC();
};
async function getMessageFromGPT(userInput) {
  if (peerConnection?.signalingState === 'stable' || peerConnection?.iceConnectionState === 'connected') {
    // Get the user input from the text input field
    // const userInput = document.getElementById('user-input-field').value;

    // Use OpenAI's GPT-3 to generate a response
    // 假设 generateChatResponse 是一个函数，能够异步地从 GPT-3 获取响应
    const chatResponse = await generateChatResponse(userInput);
    var chatBox = document.getElementById('chat-box');

    // 创建新的消息元素
    var receivedMessageElement = document.createElement('div');
    receivedMessageElement.className = 'message-received clearfix';
    receivedMessageElement.textContent = chatResponse; // 安全地设置文本内容
    // 将换行符 \n 替换为 HTML 的 <br> 标签
    receivedMessageElement.innerHTML = chatResponse.replace(/\n/g, '<br>');
    // 将新的消息元素添加到聊天框中
    chatBox.appendChild(receivedMessageElement);
    chatBox.scrollTop = chatBox.scrollHeight;

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
          provider: { type: 'microsoft', voice_id: 'zh-cn-XiaomoNeural' },
          ssml: true,
          input: chatResponse, // Use the GPT-3 response as the input value
        },
        config: {
          fluent: true,
          pad_audio: 0,
          driver_expressions: {
            /**
             * 表情：
             * neutral	默认的表达开始与每一个视频
             * happy	使得头微笑，影响的嘴和眼睛
             * surprise	使身提出了自己的眉毛和更广泛的打开他们的嘴
             * serious	使得头公司的眉毛和锻炼的嘴唇创造一个更严肃的口气
             */
            expressions: [{ expression: 'happy', start_frame: 0, intensity: 0 }],
            transition_frames: 0,
          },
          align_driver: true,
          align_expand_factor: 0,
          auto_match: true,
          motion_factor: 0,
          normalization_factor: 0,
          sharpen: true,
          stitch: true,
          result_format: 'mp4',
        },
        // driver_url	描述
        // bank://nostalgia	温柔和的缓慢运动
        // bank://fun	时髦的运动与有趣的脸部表情
        // bank://dance	跳舞头动作
        // bank://classics	唱运动|作出一定要设置 "mute": false
        // bank://subtle	细微的动作|工作最多的面孔，彼此靠近在一个单一的图像
        // bank://stitch	最好的作品时 "stitch": true
        'driver_url': 'bank://lively/',
        'config': {
          'stitch': true,
        },
        'session_id': sessionId,
      }),
    });
  }
}
function onIceGatheringStateChange() {
  iceGatheringStatusLabel.innerText = peerConnection.iceGatheringState;
  iceGatheringStatusLabel.className = 'iceGatheringState-' + peerConnection.iceGatheringState;
}
function onIceCandidate(event) {
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
function onIceConnectionStateChange() {
  iceStatusLabel.innerText = peerConnection.iceConnectionState;
  iceStatusLabel.className = 'iceConnectionState-' + peerConnection.iceConnectionState;
  if (peerConnection.iceConnectionState === 'failed' || peerConnection.iceConnectionState === 'closed') {
    stopAllStreams();
    closePC();
  }
}
function onConnectionStateChange() {
  // not supported in firefox
  peerStatusLabel.innerText = peerConnection.connectionState;
  peerStatusLabel.className = 'peerConnectionState-' + peerConnection.connectionState;
}
function onSignalingStateChange() {
  signalingStatusLabel.innerText = peerConnection.signalingState;
  signalingStatusLabel.className = 'signalingState-' + peerConnection.signalingState;
}
function onTrack(event) {
  const remoteStream = event.streams[0];
  setVideoElement(remoteStream);
}

async function createPeerConnection(offer, iceServers) {
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

function setVideoElement(stream) {
  if (!stream) return;
  talkVideo.srcObject = stream;

  // safari hotfix
  if (talkVideo.paused) {
    talkVideo.play().then(_ => {}).catch(e => {});
  }
}

function stopAllStreams() {
  if (talkVideo.srcObject) {
    console.log('stopping video streams');
    talkVideo.srcObject.getTracks().forEach(track => track.stop());
    talkVideo.srcObject = null;
  }
}

function closePC(pc = peerConnection) {
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



