const { 
    EmbedBuilder, 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    Events
  } = require('discord.js');
  const logger = require('../logger');
  const config = require('../config/bot-config');
  const commandManager = require('../commands');
  
  /**
   * 웰컴 모듈 클래스
   */
  class WelcomeModule {
    constructor(client) {
      this.client = client;
      this.name = 'welcome';
      this.description = '서버 입장/퇴장 알림 모듈';
      this.enabled = config.get('modules.welcome.enabled', true);
      
      // 모듈 등록 명령어 생성
      this.registerCommands();
      
      logger.module(this.name, '웰컴 모듈이 초기화되었습니다.');
    }
  
    /**
     * 모듈 이벤트 리스너 등록
     */
    registerEvents() {
      if (!this.enabled) {
        logger.warn(this.name, '모듈이 비활성화되어 있어 이벤트를 등록하지 않습니다.');
        return;
      }
  
      // 길드 멤버 입장 이벤트
      this.client.on(Events.GuildMemberAdd, async (member) => {
        await this.handleMemberJoin(member);
      });
  
      // 길드 멤버 퇴장 이벤트
      this.client.on(Events.GuildMemberRemove, async (member) => {
        await this.handleMemberLeave(member);
      });
  
      logger.success(this.name, '이벤트 리스너가 등록되었습니다.');
    }
  
    /**
     * 슬래시 커맨드 등록
     */
    registerCommands() {
      const welcomeSetCommand = new SlashCommandBuilder()
        .setName('환영채널설정')
        .setDescription('입장/퇴장 메시지를 보낼 채널을 설정합니다.')
        .addChannelOption(option => 
          option.setName('채널')
            .setDescription('알림을 보낼 채널을 선택하세요.')
            .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .toJSON();
  
      const toggleWelcomeCommand = new SlashCommandBuilder()
        .setName('환영메시지')
        .setDescription('입장/퇴장 메시지를 활성화하거나 비활성화합니다.')
        .addBooleanOption(option => 
          option.setName('활성화')
            .setDescription('활성화 여부 (true: 활성화, false: 비활성화)')
            .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .toJSON();
  
      // 커맨드 매니저에 명령어 등록
      commandManager.registerModuleCommands(this.name, [
        welcomeSetCommand,
        toggleWelcomeCommand
      ]);
    }
  
    /**
     * 명령어 실행 처리
     * @param {Interaction} interaction 상호작용 객체
     */
    async handleCommands(interaction) {
      if (!interaction.isCommand()) return;
  
      const { commandName } = interaction;
  
      if (commandName === '환영채널설정') {
        await this.handleSetWelcomeChannel(interaction);
      } else if (commandName === '환영메시지') {
        await this.handleToggleWelcome(interaction);
      }
    }
  
    /**
     * 환영 채널 설정 명령어 처리
     * @param {Interaction} interaction 상호작용 객체
     */
    async handleSetWelcomeChannel(interaction) {
      try {
        const channel = interaction.options.getChannel('채널');
        
        // 채널 권한 확인
        if (!channel.viewable || !channel.permissionsFor(interaction.guild.members.me).has('SendMessages')) {
          return interaction.reply({
            content: '❌ 선택한 채널에 메시지를 보낼 권한이 없습니다!',
            ephemeral: true
          });
        }
        
        // 설정 업데이트
        config.set('welcomeChannelId', channel.id);
        
        const embed = new EmbedBuilder()
          .setColor('#43B581')
          .setTitle('✅ 환영 채널 설정 완료')
          .setDescription(`입장/퇴장 메시지가 <#${channel.id}> 채널로 전송됩니다.`)
          .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
        logger.success(this.name, `환영 채널이 #${channel.name} (${channel.id})로 설정되었습니다.`);
      } catch (error) {
        logger.error(this.name, `환영 채널 설정 오류: ${error.message}`);
        await interaction.reply({
          content: '❌ 채널 설정 중 오류가 발생했습니다.',
          ephemeral: true
        });
      }
    }
  
    /**
     * 환영 메시지 토글 명령어 처리
     * @param {Interaction} interaction 상호작용 객체
     */
    async handleToggleWelcome(interaction) {
      try {
        const enabled = interaction.options.getBoolean('활성화');
        
        // 설정 업데이트
        config.updateModuleConfig(this.name, { enabled });
        this.enabled = enabled;
        
        const embed = new EmbedBuilder()
          .setColor(enabled ? '#43B581' : '#F04747')
          .setTitle(`${enabled ? '✅ 환영 메시지 활성화' : '⛔ 환영 메시지 비활성화'}`)
          .setDescription(`입장/퇴장 메시지가 ${enabled ? '활성화' : '비활성화'}되었습니다.`)
          .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
        logger.success(this.name, `환영 메시지가 ${enabled ? '활성화' : '비활성화'}되었습니다.`);
      } catch (error) {
        logger.error(this.name, `환영 메시지 토글 오류: ${error.message}`);
        await interaction.reply({
          content: '❌ 설정 변경 중 오류가 발생했습니다.',
          ephemeral: true
        });
      }
    }
  
    /**
     * 멤버 입장 처리
     * @param {GuildMember} member 길드 멤버
     */
    async handleMemberJoin(member) {
      if (!this.enabled) return;
      
      try {
        const welcomeChannelId = config.get('welcomeChannelId');
        if (!welcomeChannelId) {
          return logger.warn(this.name, '환영 채널이 설정되지 않았습니다.');
        }
        
        const channel = member.guild.channels.cache.get(welcomeChannelId);
        if (!channel) {
          return logger.warn(this.name, '설정된 환영 채널을 찾을 수 없습니다.');
        }
        
        // 임베드 메시지 생성
        const embed = new EmbedBuilder()
          .setColor('#43B581')
          .setTitle('👋 환영합니다!')
          .setDescription(config.get('modules.welcome.joinMessage', '{username}님이 서버에 입장했습니다!').replace('{username}', member.user.username))
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
          .addFields(
            { name: '👤 유저 정보', value: `\`\`\`유저 ID: ${member.id}\n계정 생성일: ${member.user.createdAt.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })} (${Math.floor((Date.now() - member.user.createdAt) / (1000 * 60 * 60 * 24))}일)\n서버 참가일: ${member.joinedAt.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })} (0일)\`\`\``, inline: false },
          )
          .setImage(member.guild.bannerURL({ format: 'png', size: 1024 }) || null)
          .setFooter({ text: `블루스 • ${new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })} 오후 ${new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })}`, iconURL: member.guild.iconURL() })
          .setTimestamp();
        
        await channel.send({ embeds: [embed] });
        logger.success(this.name, `${member.user.tag}님의 입장 메시지를 전송했습니다.`);
      } catch (error) {
        logger.error(this.name, `멤버 입장 처리 오류: ${error.message}`);
      }
    }
  
    /**
     * 멤버 퇴장 처리
     * @param {GuildMember} member 길드 멤버
     */
    async handleMemberLeave(member) {
      if (!this.enabled) return;
      
      try {
        const welcomeChannelId = config.get('welcomeChannelId');
        if (!welcomeChannelId) {
          return logger.warn(this.name, '환영 채널이 설정되지 않았습니다.');
        }
        
        const channel = member.guild.channels.cache.get(welcomeChannelId);
        if (!channel) {
          return logger.warn(this.name, '설정된 환영 채널을 찾을 수 없습니다.');
        }
        
        // 임베드 메시지 생성
        const embed = new EmbedBuilder()
          .setColor('#F04747')
          .setTitle('👋 안녕히 가세요!')
          .setDescription(config.get('modules.welcome.leaveMessage', '{username}님이 서버에서 퇴장했습니다!').replace('{username}', member.user.username))
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
          .addFields(
            { name: '👤 유저 정보', value: `\`\`\`유저 ID: ${member.id}\n서버 탈퇴일: ${new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })} (0일)\`\`\``, inline: false },
          )
          .setImage(member.guild.bannerURL({ format: 'png', size: 1024 }) || null)
          .setFooter({ text: `블루스 • ${new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })} 오후 ${new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })}`, iconURL: member.guild.iconURL() })
          .setTimestamp();
        
        await channel.send({ embeds: [embed] });
        logger.success(this.name, `${member.user.tag}님의 퇴장 메시지를 전송했습니다.`);
      } catch (error) {
        logger.error(this.name, `멤버 퇴장 처리 오류: ${error.message}`);
      }
    }
  
    /**
     * 모듈을 초기화하고 시작합니다.
     */
    start() {
      if (this.enabled) {
        this.registerEvents();
        logger.success(this.name, '웰컴 모듈이 활성화되었습니다.');
      } else {
        logger.warn(this.name, '웰컴 모듈이 비활성화되어 있습니다.');
      }
      return this;
    }
  }
  
  module.exports = (client) => new WelcomeModule(client);