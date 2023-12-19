
import { openAIConfig, stylesTranslations } from './config.js';

// 参数设置：
let selectedPresenterPosterUrl = '';  // 数字人头像
let selectedEmotion = 'neutral'; // 情绪默认值
let selectedIntensity = 0.5;
let selectedVoiceId = 'zh-cn-XiaomoNeural'; // 声音默认值
let selectedStyle = 'assistant'; // 说话风格默认为空
let selectedModel = openAIConfig.models.davinci; // 默认为 turbo 模型
let conversationHistory = []; // 假设有一个全局变量来保存对话历史

export function createOption(container, label, value, type, ...additionalArgs) {
    const optionDiv = document.createElement('div');
    optionDiv.classList.add('option');
    optionDiv.textContent = label;
    optionDiv.setAttribute('data-value', value);

    optionDiv.addEventListener('click', function() {
        container.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
        this.classList.add('selected');

        // 根据类型调用不同的处理函数
        switch (type) {
            case 'emotion':
                selectedEmotion = value;
                selectedIntensity = additionalArgs[0] !== undefined ? additionalArgs[0] : 0.5; // 使用额外参数作为强度
                localStorage.setItem('selectedIntensity', selectedIntensity);
                localStorage.setItem('selectedEmotion', selectedEmotion);
                break;
            case 'voice':
                selectedVoiceId = value;
                localStorage.setItem('selectedVoiceId', value);
                break;
            case 'model':
                selectedModel = value;
                // 切换模型前清空历史消息。
                conversationHistory = [];
                console.log("Selected model:", selectedModel);
                // 在抽屉设置页面中
                localStorage.setItem('selectedModel', value); // 设置模型
                break;
            case 'speakingStyle':
                selectedStyle = value;
                localStorage.setItem('selectedStyle', value);
                break;
            // 其他类型的处理...
        }
    });

    container.appendChild(optionDiv);
}

export function showLoader(container) {
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
export function hideLoader(container) {
    const loader = document.querySelector('.loader');
    if (loader) {
        loader.remove(); // 如果加载指示器存在，则移除
    }
}

// 格式化代码块的函数
export function formatCodeBlocks(element) {
    const text = element.textContent;
    if (text.includes('```')) {
        const formattedHtml = text.replace(/```(.*?)```/gs, '<pre class="code-block">$1</pre>');
        element.innerHTML = formattedHtml;
    }
}

// 逐字显示消息的函数
export function typeMessage(message, element, speed = 50) {
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

// 更新说话风格选项的函数
export function updateSpeakingStyles(styles, container) {
    const speakingStylesContainer = document.getElementById('speaking-options');
    speakingStylesContainer.innerHTML = ''; // 清空现有的选项

    styles.forEach(style => {
        const styleChinese = stylesTranslations[style] || style; // 使用翻译，或者如果没有翻译则使用原始值
        createOption(speakingStylesContainer, styleChinese, style, 'speakingStyle');
    });
}

export function translateVoiceLabel(language, name) {
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

export async function callOpenAI(apiUrl, data) {
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
