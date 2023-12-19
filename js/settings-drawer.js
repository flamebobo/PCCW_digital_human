// settings-drawer.js
import { createOption, updateSpeakingStyles, translateVoiceLabel } from './utils.js';
import { emotionsWithIntensity } from './config.js';

// 参数设置：
let selectedPresenterPosterUrl = '';  // 数字人头像
let selectedEmotion = 'neutral'; // 情绪默认值
let selectedIntensity = 0.5;
let selectedVoiceId = 'zh-cn-XiaomoNeural'; // 声音默认值
let selectedStyle = 'assistant'; // 说话风格默认为空
const connectButton = document.getElementById('connect-button');
document.addEventListener('DOMContentLoaded', () => {
    // 绑定侧边栏开关事件监听器
    document.getElementById("sidebar-toggle").addEventListener("click", function() {
        document.getElementById("sidebar").style.right = "0";
        document.getElementById("main-content").classList.add("reduce");
    });

    // 绑定关闭按钮事件
    document.getElementById('close-btn').addEventListener('click', function() {
        closeSidebar();
    });

    loadPresenters();
    loadVoiceOptions();
    loadEmotionOptions();
    loadModelOptions();

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
        // console.log("models:",openAIConfig.models);
    });

    document.getElementById('cancel-button').addEventListener('click', () => {
        closeSidebar(); // Just close the sidebar for cancel
    });
    // 绑定关闭按钮事件
    document.getElementById('close-btn').addEventListener('click', function() {
        closeSidebar();
    });
});


async function loadPresenters() {
    // Assuming the image.json is at the same level as your HTML file
    const response = await fetch('./resource/images.json');
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

function loadEmotionOptions() {
    const emotions = {'neutral': '中性', 'happy':'开心', 'surprise': '惊喜', 'serious':'严肃'};
    const emotionOptionsContainer = document.getElementById('emotion-options');
    Object.keys(emotions).forEach(emotionKey => {
        createOption(emotionOptionsContainer, emotions[emotionKey], emotionKey, 'emotion');
    });
}


async function loadVoiceOptions() {
    const response = await fetch('./resource/voices.json');
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

function loadModelOptions() {
    const models = {'gpt-3.5-turbo': 'gpt-3.5-turbo', 'text-davinci-003': 'text-davinci-003'};
    const modelOptionsContainer = document.getElementById('model-options');

    Object.keys(models).forEach(modelKey => {
        // 使用更具可读性的键作为标签（如 'turbo' 或 'davinci'）
        // 并将实际的模型标识符（如 'gpt-3.5-turbo' 或 'text-davinci-003'）作为值
        createOption(modelOptionsContainer, modelKey, models[modelKey], 'model');
    });
}

function closeSidebar() {
    document.getElementById('sidebar').style.right = '-30vw'; // 或者使用您的抽屉宽度
    document.getElementById('main-content').classList.remove('reduce');
}

