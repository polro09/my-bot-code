const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    Collection,
    Events,
    ActivityType
  } = require('discord.js');
  const fs = require('fs');
  const path = require('path');
  const dotenv = require('dotenv');
  const logger = require('./logger');
  const commandManager = require('./commands');
  const config = require('./config/bot-config');
  
  // 환경 변수 로드
  dotenv.config();
  
  // 클라이언트 초기화
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ],
    partials: [
      Partials.User,
      Partials.Channel,
      Partials.GuildMember,
      Partials.Message
    ]
  });
  
  // 모듈 및 이벤트 컬렉션 초기화
  client.modules = new Collection();
  client.events = new Collection();
  
  /**
   * 모듈 로딩 함수
   */
  async function loadModules() {
    logger.system('Loader', '모듈 로딩 중...');
    
    try {
      const modulesPath = path.join(__dirname, 'modules');
      // 모듈 디렉토리가 없으면 생성
      if (!fs.existsSync(modulesPath)) {
        fs.mkdirSync(modulesPath, { recursive: true });
      }
      
      const moduleFiles = fs.readdirSync(modulesPath).filter(file => file.endsWith('.js'));
      
      if (moduleFiles.length === 0) {
        logger.warn('Loader', '모듈 디렉토리에 모듈이 없습니다.');
        return;
      }
      
      for (const file of moduleFiles) {
        try {
          const modulePath = path.join(modulesPath, file);
          const moduleFunction = require(modulePath);
          
          // 모듈 초기화 및 등록
          if (typeof moduleFunction === 'function') {
            const moduleInstance = moduleFunction(client);
            client.modules.set(moduleInstance.name, moduleInstance);
            logger.module('Loader', `'${moduleInstance.name}' 모듈이 로드되었습니다.`);
            
            // 모듈 시작
            if (typeof moduleInstance.start === 'function') {
              moduleInstance.start();
            }
          } else {
            logger.warn('Loader', `'${file}' 모듈이 유효한 형식이 아닙니다.`);
          }
        } catch (error) {
          logger.error('Loader', `'${file}' 모듈 로딩 중 오류 발생: ${error.message}`);
        }
      }
      
      logger.success('Loader', `${client.modules.size}개 모듈이 로드되었습니다.`);
    } catch (error) {
      logger.error('Loader', `모듈 로딩 중 오류 발생: ${error.message}`);
    }
  }
  
  /**
   * 웹 서버 초기화 함수
   */
  async function initWebServer() {
    try {
      const WebServer = require('./web/server');
      const webServer = WebServer(client);
      webServer.start();
      client.webServer = webServer;
    } catch (error) {
      logger.error('WebServer', `웹 서버 초기화 중 오류 발생: ${error.message}`);
    }
  }
  
  // 클라이언트 이벤트 핸들러
  client.on(Events.ClientReady, () => {
    logger.success('Bot', `봇이 준비되었습니다. 로그인: ${client.user.tag}`);
    
    // 상태 메시지 설정
    client.user.setPresence({
      activities: [{ name: process.env.BOT_STATUS || 'aimbot.ad 모듈형 봇', type: ActivityType.Playing }],
      status: 'online'
    });
    
    // 슬래시 커맨드 배포
    commandManager.deployCommands();
    
    // 웹 서버 초기화
    initWebServer();
  });
  
  // 명령어 처리
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isCommand()) return;
    
    const { commandName } = interaction;
    logger.command('Interaction', `'${interaction.user.tag}'님이 '${commandName}' 명령어를 사용했습니다.`);
    
    // 모듈별 명령어 처리
    for (const [name, module] of client.modules) {
      if (typeof module.handleCommands === 'function') {
        try {
          await module.handleCommands(interaction);
        } catch (error) {
          logger.error('Command', `'${name}' 모듈의 명령어 처리 중 오류 발생: ${error.message}`);
        }
      }
    }
  });
  
  // 에러 핸들링
  client.on(Events.Error, (error) => {
    logger.error('Discord', `클라이언트 에러: ${error.message}`);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Process', `처리되지 않은 Promise 거부: ${reason}`);
  });
  
  process.on('uncaughtException', (error) => {
    logger.error('Process', `예상치 못한 예외 발생: ${error.message}`);
    logger.error('Process', `스택 트레이스: ${error.stack}`);
  });
  
  // 봇 시작
  async function startBot() {
    logger.system('Bot', '봇을 시작합니다...');
    
    try {
      // 모듈 로드
      await loadModules();
      
      // 봇 로그인
      await client.login(process.env.BOT_TOKEN);
    } catch (error) {
      logger.error('Bot', `봇 시작 중 오류 발생: ${error.message}`);
      process.exit(1);
    }
  }
  
  // 시작
  startBot();