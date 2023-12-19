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
let selectedPresenterPosterUrl = '';  // 数字人头像
let selectedEmotion = 'neutral'; // 情绪默认值
let selectedIntensity = 0.5;
let selectedVoiceId = 'zh-cn-XiaomoNeural'; // 声音默认值
let selectedStyle = 'assistant'; // 说话风格默认为空

// 情绪和强度的映射
const emotionsWithIntensity = {
  'neutral': { label: '中性', intensity: 0.5 },
  'happy': { label: '开心', intensity: 1.0 },
  'surprise': { label: '惊喜', intensity: 1.0 },
  'serious': { label: '严肃', intensity: 0.5 }
};


// OpenAI API 配置
const openAIConfig = {
  apiKey: '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',
  models: {
    turbo: 'gpt-3.5-turbo',
    davinci: 'text-davinci-003'
  },
  getChatEndpoint: function(model) {
    return model === this.models.turbo ?
        'https://api.openai.com/v1/chat/completions' :
        `https://api.openai.com/v1/engines/${model}/completions`;
  }
};
// 新增全局变量来保存用户选择的模型
let selectedModel = openAIConfig.models.davinci; // 默认为 turbo 模型
// 获取DOM元素
const talkVideo = document.getElementById('talk-video');
talkVideo.setAttribute('playsinline', '');
const peerStatusLabel = document.getElementById('peer-status-label');
const iceStatusLabel = document.getElementById('ice-status-label');
const iceGatheringStatusLabel = document.getElementById('ice-gathering-status-label');
const signalingStatusLabel = document.getElementById('signaling-status-label');

const stylesTranslations = {
  'assistant': '助手',
  'chat': '聊天',
  'customerservice': '客服',
  'newscast': '新闻播报',
  'affectionate': '亲密',
  'angry': '愤怒',
  'calm': '平静',
  'cheerful': '愉快',
  'disgruntled': '不满',
  'fearful': '恐惧',
  'gentle': '温柔',
  'lyrical': '抒情',
  'sad': '悲伤',
  'serious': '严肃',
  'poetry-reading': '朗读诗歌',
  'friendly': '友好',
  'chat-casual': '随便聊',
  'whisper': '耳语',
  'sorry': '抱歉',
  'narration-relaxed': '松弛',
  'embarrassed':'尴尬',
  'depressed':'沮丧',
  'sports-commentary':'体育评论',
  'sports-commentary-excited':'体育解说兴奋',
  'documentary-narration':'纪实叙事',
  'narration-professional':'叙事专业',
  'newscast-casual':'新闻广播-休闲',
  'livecommercial':'商业生活',
  'advertisement-upbeat':'广告-乐观',
  'envious':'羡慕'
};

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
  loadVoiceOptions(); // 加载声音选项

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

async function loadVoiceOptions() {
  const response = await fetch('./voices.json');
  const voices = await response.json();
  const chineseVoices = voices.filter(voice => voice.language.includes('中文'));

  const voiceOptionsContainer = document.getElementById('voice-options');
  voiceOptionsContainer.innerHTML = ''; // 清空现有选项

  chineseVoices.forEach(voice => {
    const value = voice.id;
    const label = translateVoiceLabel(voice.language, voice.name); // 调用翻译函数
    createOption(voiceOptionsContainer, label, value, 'voice');
  });

  // 声音选择的事件处理器
  document.getElementById('voice-options').addEventListener('click', function(event) {
    if (event.target && event.target.matches('.option')) {
      const selectedVoiceId = event.target.getAttribute('data-value');
      const selectedVoice = voices.find(voice => voice.id === selectedVoiceId);
      if (selectedVoice && selectedVoice.styles) {
        updateSpeakingStyles(selectedVoice.styles);
      }else {
        const speakingStylesContainer = document.getElementById('speaking-options');
        speakingStylesContainer.innerHTML = ''; // 清空现有的选项
      }
    }
  });

}

function translateVoiceLabel(language, name) {
  const languageMap = {
    'Chinese (Taiwanese Mandarin, Traditional)': '中文台湾普通话',
    'Chinese (Mandarin, Simplified)': '中文大陆普通话',
    // 添加其他语言映射
  };

  const nameMap = {
    'Zhiwei': '志伟',
    'Yating': '雅婷',
    // 添加其他名字映射
  };

  const translatedLanguage = languageMap[language.split(' ')[0]] || language.split(' ')[0];
  const translatedName = nameMap[name] || name;
  return `${translatedLanguage}-${translatedName}`;
}


document.addEventListener('DOMContentLoaded', () => {
  // ... loadPresenters and other initialization code ...

  // Bind event listeners to the new buttons
  document.getElementById('confirm-button').addEventListener('click', () => {
    // Set the selected presenter's poster URL to the connectButton's data attribute
    const connectButton = document.getElementById('connect-button');
    connectButton.setAttribute('data-source-url', selectedPresenterPosterUrl);
    // You might also want to trigger the connectButton's click event
    connectButton.click();

    closeSidebar(); // Close the sidebar upon confirmation

    console.log("selectedPresenterPosterUrl:",selectedPresenterPosterUrl);
    console.log("selectedEmotion:",selectedEmotion);
    console.log("selectedVoiceId:",selectedVoiceId);
    console.log("models:",openAIConfig.models);
  });

  // 绑定演示者选项的点击事件，更新选中的演示者的poster URL
  document.querySelectorAll('.presenter').forEach(presenter => {
    presenter.addEventListener('click', function() {
      selectedPresenterPosterUrl = this.dataset.poster;
      // 可以在这里直接更新当前演示者的显示
      document.getElementById('current-presenter').src = selectedPresenterPosterUrl;
      // 更新视频标题
      document.querySelector('.video-title').textContent = this.dataset.name;
    });
  });

  document.getElementById('cancel-button').addEventListener('click', () => {
    closeSidebar(); // Just close the sidebar for cancel
  });

  // Emotion options['neutral', 'happy', 'surprise', 'serious'];
  const emotions = {'neutral': '中性', 'happy':'开心', 'surprise': '惊喜', 'serious':'严肃'};
  const emotionOptionsContainer = document.getElementById('emotion-options');

  Object.keys(emotions).forEach(emotionKey => {
    // 使用 emotions 对象来获取正确的情绪标签
    const emotionLabel = emotions[emotionKey];
    const intensity = emotionsWithIntensity[emotionKey]?.intensity || 0.5; // 默认强度为 0.5

    createOption(emotionOptionsContainer, emotionLabel, emotionKey, 'emotion', intensity);
  });

  const models = {'gpt-3.5-turbo': 'gpt-3.5-turbo', 'text-davinci-003': 'text-davinci-003'};
  const modelOptionsContainer = document.getElementById('model-options');

  Object.keys(models).forEach(modelKey => {
    // 使用更具可读性的键作为标签（如 'turbo' 或 'davinci'）
    // 并将实际的模型标识符（如 'gpt-3.5-turbo' 或 'text-davinci-003'）作为值
    createOption(modelOptionsContainer, modelKey, models[modelKey], 'model');
  });

});

// 更新说话风格选项的函数
function updateSpeakingStyles(styles) {
  const speakingStylesContainer = document.getElementById('speaking-options');
  speakingStylesContainer.innerHTML = ''; // 清空现有的选项

  styles.forEach(style => {
    const styleChinese = stylesTranslations[style] || style; // 使用翻译，或者如果没有翻译则使用原始值
    createOption(speakingStylesContainer, styleChinese, style, 'speakingStyle');
  });
}
function createOption(container, label, value, type, ...additionalArgs) {
  const optionDiv = document.createElement('div');
  optionDiv.classList.add('option');
  optionDiv.textContent = label;
  optionDiv.setAttribute('data-value', value);

  optionDiv.addEventListener('click', function() {
    container.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
    this.classList.add('selected');

    switch (type) {
      case 'emotion':
        selectedEmotion = value;
        selectedIntensity = additionalArgs[0] !== undefined ? additionalArgs[0] : 0.5; // 使用额外参数作为强度
        break;
      case 'voice':
        selectedVoiceId = value;
        break;
      case 'model':
        selectedModel = value;
        // 切换模型前清空历史消息。
        conversationHistory = [];
        console.log("Selected model:", selectedModel);
        break;
      case 'style':
        selectedStyle = value;
        break;
        // 其他类型的处理...
    }
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

// 使用API调用OpenAI的函数
async function callOpenAI(apiUrl, data) {
  showLoader();
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    hideLoader();
    return responseData;
  } catch (error) {
    hideLoader();
    console.error('Error calling OpenAI API:', error);
    return null;
  }
}


// 修改 generateChatResponseTurbo 函数
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

// 修改 generateChatResponseDavinci 函数
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
  const chatBox = document.getElementById('chat-box');
  let chatResponse = '';
  // 根据选中的模型来调用相应的函数
  console.log("selectedModel====:", selectedModel)
  if (selectedModel === openAIConfig.models.turbo) {
    chatResponse = await generateChatResponseTurbo(userInput, openAIConfig.models.turbo);
  } else if (selectedModel === openAIConfig.models.davinci) {
    chatResponse = await generateChatResponseDavinci(userInput, openAIConfig.models.davinci);
  } else {
    console.error('No model selected');
    return;
  }

  // 逐字显示消息
  // 当从GPT获取到响应后
  const receivedMessageElement = document.createElement('div');
  receivedMessageElement.className = 'message-received clearfix';
  chatBox.appendChild(receivedMessageElement);
  typeMessage(chatResponse, receivedMessageElement); // 使用逐字打印方法

  // 调用DID
  getMessageFromDID(chatResponse);
}
// 逐字显示消息的函数
function typeMessage(message, element) {
  let i = 0;
  const typingSpeed = 50; // 打字速度，单位为毫秒
  element.textContent = ''; // 清空元素的当前内容
  element.style.display = 'block'; // 显示元素

  function typing() {
    if (i < message.length) {
      // 如果遇到代码块标记，就一次性打印整个代码块
      if (message.slice(i).startsWith('```')) {
        let codeBlockEnd = message.indexOf('```', i + 3);
        if (codeBlockEnd === -1) {
          codeBlockEnd = message.length;
        }
        // 包括结束的反引号在内一次性打印
        element.textContent += message.slice(i, codeBlockEnd + 3);
        i = codeBlockEnd + 3;
      } else {
        element.textContent += message.charAt(i);
        i++;
      }
      setTimeout(typing, typingSpeed);
    } else {
      // 打字结束后，如果有代码块，将其格式化
      formatCodeBlocks(element);
      element.style.display = ''; // 隐藏正在输入的提示
    }
  }
  typing();
}

// 格式化代码块的函数
function formatCodeBlocks(element) {
  const text = element.textContent;
  if (text.includes('```')) {
    const formattedHtml = text.replace(/```(.*?)```/gs, '<pre class="code-block">$1</pre>');
    element.innerHTML = formattedHtml;
  }
}

// 显示加载指示器的函数
function showLoader() {
  const chatBox = document.getElementById('chat-box');
  const loader = document.createElement('div');
  loader.className = 'loader';

  // 如果已经有一个加载指示器，则不再添加
  if (!chatBox.querySelector('.loader')) {
    chatBox.appendChild(loader);
  }

  // 将加载指示器放置在消息输入框的上方
  loader.style.bottom = (chatBox.offsetHeight + 15) + 'px';
}


// 接收到响应后移除加载指示器的函数
function hideLoader() {
  const loader = document.querySelector('.loader');
  if (loader) {
    loader.remove(); // 如果加载指示器存在，则移除
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
        provider: { type: 'microsoft', voice_id: selectedVoiceId, voice_config: { style: selectedStyle}},
        ssml: true,
        input: chatResponse, // Use the GPT-3 response as the input value
      },
      config: {
        fluent: true,
        pad_audio: 0,
        driver_expressions: {
          expressions: [{ expression: selectedEmotion, start_frame: 0, intensity: selectedIntensity }],
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



