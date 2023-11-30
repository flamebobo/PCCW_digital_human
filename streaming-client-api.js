//Edit by Fang Wang on Oct 17 2023
'use strict';

// 导入API配置，这应该包含API的URL和Key。
import DID_API from './api.json' assert { type: 'json' };
if (DID_API.key == '🤫') alert('Please put your api key inside ./api.json and restart..')

// 兼容不同浏览器的RTCPeerConnection构造函数。
const RTCPeerConnection = (window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection).bind(window);

// 定义全局变量
let peerConnection;
let streamId;
let sessionId;
let sessionClientAnswer;

// 参数设置：
let selectedPresenterPosterUrl = '';

// 获取DOM元素
const talkVideo = document.getElementById('talk-video');
talkVideo.setAttribute('playsinline', '');
const peerStatusLabel = document.getElementById('peer-status-label');
const iceStatusLabel = document.getElementById('ice-status-label');
const iceGatheringStatusLabel = document.getElementById('ice-gathering-status-label');
const signalingStatusLabel = document.getElementById('signaling-status-label');

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

document.addEventListener('DOMContentLoaded', () => {
  loadPresenters();


  // 绑定关闭按钮事件
  document.getElementById('close-btn').addEventListener('click', function() {
    closeSidebar();
  });
});

async function loadPresenters() {
  // Assuming the image.json is at the same level as your HTML file
  const response = await fetch('./images.json');
  let presenters = await response.json();

  // Reverse the array to display presenters in descending order
  presenters = presenters.reverse();

  // Select the presenter list element
  const presenterList = document.getElementById('presenter-list');
  presenterList.innerHTML = ''; // Clear existing presenters

  // Create presenter elements
  presenters.forEach(presenter => {
    const presenterElement = document.createElement('div');
    presenterElement.classList.add('presenter');
    presenterElement.innerHTML = `<img src="${presenter.thumbnail}" alt="${presenter.name}" data-poster="${presenter.poster}" data-name="${presenter.name}">`;
    presenterElement.addEventListener('click', function() {
      selectedPresenterPosterUrl = this.querySelector('img').dataset.poster;
      connectButton.setAttribute('data-source-url', selectedPresenterPosterUrl);
      // 可以在这里直接更新当前演示者的显示
      document.getElementById('current-presenter').src = selectedPresenterPosterUrl;
      // 更新视频标题
      document.querySelector('.video-title').textContent = this.querySelector('img').dataset.name;
    });

    presenterList.appendChild(presenterElement);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // ... loadPresenters and other initialization code ...

  // Bind event listeners to the new buttons
  document.getElementById('confirm-button').addEventListener('click', () => {
    // Set the selected presenter's poster URL to the connectButton's data attribute
    const connectButton = document.getElementById('connect-button');
    connectButton.setAttribute('data-source-url', selectedPresenterPosterUrl);
    // You might also want to trigger the connectButton's click event
    // connectButton.click();
    closeSidebar(); // Close the sidebar upon confirmation
  });

  document.getElementById('cancel-button').addEventListener('click', () => {
    closeSidebar(); // Just close the sidebar for cancel
  });

  // Emotion options['neutral', 'happy', 'surprise', 'serious'];
  const emotions = {'neutral': '中性', 'happy':'开心', 'surprise': '惊喜', 'serious':'严肃'};
  const emotionOptionsContainer = document.getElementById('emotion-options');
  Object.keys(emotions).forEach(emotionKey => createOption(emotionOptionsContainer, emotions[emotionKey], emotionKey));

  // Voice options
  const voices = {'zh-HK-HiuMaanNeural': '粤语小曼', 'zh-cn-XiaomoNeural': '中文小沫'};
  const voiceOptionsContainer = document.getElementById('voice-options');
  Object.keys(voices).forEach(voiceKey => createOption(voiceOptionsContainer, voices[voiceKey], voiceKey));

  const sessions = {'savaSession': '保存会话', 'instantSession': '瞬时会话'};
  const sessionOptionsContainer = document.getElementById('session-options');
  Object.keys(sessions).forEach(sessionKey => createOption(sessionOptionsContainer, sessions[sessionKey], sessionKey));

});

function createOption(container, label, value = label) {
  const optionDiv = document.createElement('div');
  optionDiv.classList.add('option');
  optionDiv.textContent = label;
  optionDiv.setAttribute('data-value', value);

  // Event listener for option selection
  optionDiv.addEventListener('click', function() {
    // Deselect all options
    container.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
    // Select the clicked one
    this.classList.add('selected');
  });

  container.appendChild(optionDiv);
}


// 侧边栏开关事件监听
document.getElementById("sidebar-toggle").addEventListener("click", function() {
  document.getElementById("sidebar").style.right = "0";
  document.getElementById("main-content").classList.add("reduce");
});

// 关闭侧边栏事件监听
// 关闭侧边栏的函数
function closeSidebar() {
  document.getElementById('sidebar').style.right = '-30vw'; // 或者使用您的抽屉宽度
  document.getElementById('main-content').classList.remove('reduce');
}



// 用户输入处理，监听回车键
document.getElementById('user-input-field').addEventListener('keypress', async function (e) {
  // 如果按下回车键，则发送消息并请求GPT-3生成回应
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


// 假设有一个全局变量来保存对话历史
let conversationHistory = [];

// 生成聊天回应的函数
async function generateChatResponse(userInput) {
  const apiUrl = 'https://api.openai.com/v1/chat/completions'; // 使用聊天模型的正确端点
  const apiKey = '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'; // 请使用您自己的API密钥，并确保不要公开暴露

  // 将用户的输入添加到对话历史
  conversationHistory.push({ role: "user", content: userInput });

  const settings = {
    max_tokens: 150,
    temperature: 0.5,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  };

  const data = {
    model: "gpt-3.5-turbo",
    messages: conversationHistory // 聊天模型期望的消息格式
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

    // 获取AI的响应文本
    const aiText = responseData.choices[0].message.content; // 聊天模型的响应在message.content字段内

    return aiText;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return `I'm sorry, I wasn't able to process that.`;
  }
}




// //################################
// 销毁按钮点击事件处理函数
const destroyButton = document.getElementById('destroy-button');
destroyButton.onclick = async () => {
  // 发送请求删除会话和关闭peer connection
  await fetch(`${DID_API.url}/talks/streams/${streamId}`,
    {
      method: 'DELETE',
      headers: {Authorization: `Basic ${DID_API.key}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({session_id: sessionId})
    });

  stopAllStreams();
  closePC();
};

// 如果peer connection状态是稳定的或已连接，则使用GPT-3生成回应
async function getMessageFromGPT(userInput) {
  if (peerConnection?.signalingState === 'stable' || peerConnection?.iceConnectionState === 'connected') {
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

    // 调用did
    // getMessageFromDID(chatResponse);
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
        provider: { type: 'microsoft', voice_id: 'zh-cn-XiaomoNeural' },
        ssml: true,
        input: chatResponse, // Use the GPT-3 response as the input value
      },
      config: {
        fluent: true,
        pad_audio: 0,
        driver_expressions: {
          expressions: [{ expression: 'neutral', start_frame: 0, intensity: 0 }],
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



