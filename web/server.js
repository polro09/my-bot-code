const express = require('express');
const path = require('path');
const logger = require('../logger');
const config = require('../config/bot-config');

/**
 * 웹 서버 클래스
 */
class WebServer {
  constructor(client) {
    this.client = client;
    this.app = express();
    this.port = config.get('web.port', 3000);
    this.host = config.get('web.host', 'localhost');
    this.moduleRoutes = [];
    
    this.setupMiddleware();
    this.setupRoutes();
    
    logger.web('Server', '웹 서버가 초기화되었습니다.');
  }

  /**
   * 미들웨어 설정
   */
  setupMiddleware() {
    // 정적 파일 제공
    this.app.use(express.static(path.join(__dirname, 'public')));
    
    // EJS 템플릿 엔진 설정
    this.app.set('views', path.join(__dirname, 'views'));
    this.app.set('view engine', 'ejs');
    
    // JSON 파싱
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // 로깅 미들웨어
    this.app.use((req, res, next) => {
      logger.web('HTTP', `${req.method} ${req.url}`);
      next();
    });
  }

  /**
   * 라우트 설정
   */
  setupRoutes() {
    // 메인 페이지
    this.app.get('/', (req, res) => {
      res.render('index', {
        title: 'aimbot.ad 대시보드',
        client: this.client,
        botName: 'aimbot.ad',
        modules: this.getModulesList()
      });
    });
    
    // 모듈 관리 페이지
    this.app.get('/modules', (req, res) => {
      res.render('modules', {
        title: '모듈 관리',
        client: this.client,
        botName: 'aimbot.ad',
        modules: this.getModulesList()
      });
    });
    
    // 웰컴 모듈 설정 페이지
    this.app.get('/modules/welcome', (req, res) => {
      res.render('welcome', {
        title: '웰컴 모듈 설정',
        client: this.client,
        botName: 'aimbot.ad',
        config: config.getModuleConfig('welcome'),
        welcomeChannelId: config.get('welcomeChannelId')
      });
    });
    
    // 웰컴 모듈 설정 저장
    this.app.post('/modules/welcome/save', (req, res) => {
      const { enabled, joinMessage, leaveMessage, welcomeChannelId } = req.body;
      
      // 설정 업데이트
      config.updateModuleConfig('welcome', {
        enabled: enabled === 'on',
        joinMessage,
        leaveMessage
      });
      
      if (welcomeChannelId) {
        config.set('welcomeChannelId', welcomeChannelId);
      }
      
      logger.web('Welcome', '웰컴 모듈 설정이 업데이트되었습니다.');
      res.redirect('/modules/welcome?success=true');
    });
    
    // API 엔드포인트
    this.app.get('/api/status', (req, res) => {
      res.json({
        status: 'online',
        uptime: this.client.uptime,
        serverCount: this.client.guilds.cache.size,
        moduleCount: this.getModulesList().length
      });
    });
    
    // 404 페이지
    this.app.use((req, res) => {
      res.status(404).render('error', {
        title: '404 - 페이지를 찾을 수 없음',
        botName: 'aimbot.ad',
        error: {
          code: 404,
          message: '요청하신 페이지를 찾을 수 없습니다.'
        }
      });
    });
  }

  /**
   * 모듈 목록을 가져옵니다.
   * @returns {Array} 모듈 목록
   */
  getModulesList() {
    // 실제 모듈 목록은 client에서 가져와야 합니다.
    // 이 예제에서는 웰컴 모듈만 있다고 가정합니다.
    return [
      {
        name: 'welcome',
        description: '서버 입장/퇴장 알림 모듈',
        enabled: config.get('modules.welcome.enabled', true),
        configurable: true,
        configUrl: '/modules/welcome'
      }
    ];
  }

  /**
   * 모듈 라우트를 등록합니다.
   * @param {string} moduleName 모듈 이름
   * @param {function} routeHandler 라우트 핸들러 함수
   */
  registerModuleRoute(moduleName, routeHandler) {
    this.moduleRoutes.push({ moduleName, routeHandler });
    routeHandler(this.app, this.client);
    logger.web('Router', `'${moduleName}' 모듈의 라우트가 등록되었습니다.`);
  }

  /**
   * 웹 서버를 시작합니다.
   */
  start() {
    this.server = this.app.listen(this.port, this.host, () => {
      logger.success('WebServer', `웹 서버가 http://${this.host}:${this.port}/ 에서 실행 중입니다.`);
    });
    
    // 에러 처리
    this.server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error('WebServer', `포트 ${this.port}가 이미 사용 중입니다. 다른 포트를 사용하세요.`);
      } else {
        logger.error('WebServer', `웹 서버 오류: ${error.message}`);
      }
    });
    
    return this;
  }

  /**
   * 웹 서버를 중지합니다.
   */
  stop() {
    if (this.server) {
      this.server.close(() => {
        logger.info('WebServer', '웹 서버가 종료되었습니다.');
      });
    }
  }
}

module.exports = (client) => new WebServer(client);