const { 
    EmbedBuilder, 
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    PermissionFlagsBits,
    ChannelType,
    SlashCommandBuilder,
    Events,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
  } = require('discord.js');
  const logger = require('../logger');
  const config = require('../config/bot-config');
  const commandManager = require('../commands');
  const fs = require('fs');
  const path = require('path');
  
  /**
   * 티켓 시스템 모듈 클래스
   */
  class TicketModule {
    constructor(client) {
      this.client = client;
      this.name = 'ticket';
      this.description = '티켓 시스템 모듈';
      this.enabled = true;
      
      // 모듈 설정 초기화
      this.initializeConfig();
      
      // 명령어 등록
      this.registerCommands();
      
      logger.module(this.name, '티켓 시스템 모듈이 초기화되었습니다.');
    }
  
    /**
     * 모듈 설정 초기화
     */
    initializeConfig() {
      // 기본 설정 확인 및 설정
      const defaultConfig = {
        enabled: true,
        ticketCategoryId: null,
        adminRoleId: null,
        applicationChannelId: null
      };
      
      const moduleConfig = config.getModuleConfig(this.name);
      
      if (!moduleConfig || Object.keys(moduleConfig).length === 0) {
        config.updateModuleConfig(this.name, defaultConfig);
        logger.info(this.name, '기본 설정이 생성되었습니다.');
      }
      
      this.enabled = config.get(`modules.${this.name}.enabled`, true);
    }
  
    /**
     * 슬래시 커맨드 등록
     */
    registerCommands() {
      const ticketEmbedCommand = new SlashCommandBuilder()
        .setName('티켓')
        .setDescription('티켓 시스템 관리')
        .addSubcommand(subcommand =>
          subcommand
            .setName('임베드전송')
            .setDescription('티켓 생성 임베드를 채널에 전송합니다.')
            .addChannelOption(option =>
              option
                .setName('채널')
                .setDescription('임베드를 전송할 채널')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('생성카테고리')
            .setDescription('티켓이 생성될 카테고리를 설정합니다.')
            .addChannelOption(option =>
              option
                .setName('카테고리')
                .setDescription('티켓이 생성될 카테고리')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('관리자역할')
            .setDescription('티켓 관리자 역할을 설정합니다.')
            .addRoleOption(option =>
              option
                .setName('역할')
                .setDescription('티켓 관리자 역할')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('가입신청서보관채널')
            .setDescription('가입 신청서가 보관될 채널을 설정합니다.')
            .addChannelOption(option =>
              option
                .setName('채널')
                .setDescription('가입 신청서가 보관될 채널')
                .setRequired(true)
            )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON();
  
      // 커맨드 매니저에 명령어 등록
      commandManager.registerModuleCommands(this.name, [ticketEmbedCommand]);
    }
  
    /**
     * 명령어 처리 함수
     * @param {Interaction} interaction 상호작용 객체
     */
    async handleCommands(interaction) {
      if (!interaction.isCommand()) return;
      if (interaction.commandName !== '티켓') return;
  
      const subcommand = interaction.options.getSubcommand();
  
      try {
        switch (subcommand) {
          case '임베드전송':
            await this.handleTicketEmbed(interaction);
            break;
          case '생성카테고리':
            await this.handleTicketCategory(interaction);
            break;
          case '관리자역할':
            await this.handleAdminRole(interaction);
            break;
          case '가입신청서보관채널':
            await this.handleApplicationChannel(interaction);
            break;
        }
      } catch (error) {
        logger.error(this.name, `명령어 처리 중 오류 발생: ${error.message}`);
        
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({
            content: `❌ 오류가 발생했습니다: ${error.message}`,
            ephemeral: true
          });
        } else {
          await interaction.reply({
            content: `❌ 오류가 발생했습니다: ${error.message}`,
            ephemeral: true
          });
        }
      }
    }
  
    /**
     * 티켓 임베드 전송 명령어 처리
     * @param {Interaction} interaction 상호작용 객체
     */
    async handleTicketEmbed(interaction) {
      await interaction.deferReply({ ephemeral: true });
      
      const channel = interaction.options.getChannel('채널');
      
      // 채널 권한 확인
      if (!channel.viewable || !channel.permissionsFor(interaction.guild.members.me).has('SendMessages')) {
        return interaction.editReply({
          content: '❌ 선택한 채널에 메시지를 보낼 권한이 없습니다!',
          ephemeral: true
        });
      }
      
      // 티켓 임베드 생성
      const ticketEmbed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('🎫 티켓')
        .setAuthor({ name: 'Aimbot.ad', iconURL: 'https://imgur.com/Sd8qK9c.gif' })
        .setDescription('아래 버튼을 클릭하여 새 티켓을 생성하세요.\n문의사항, 길드 가입 신청 등을 위해 티켓을 생성할 수 있습니다.')
        .setThumbnail('https://imgur.com/74GDJnG.jpg')
        .addFields(
          { name: '📋 티켓 사용 방법', value: ':one: 아래 버튼을 클릭하여 새 티켓을 생성합니다.\n:two: 생성된 채널에서 필요한 정보를 입력합니다.\n:three: 관리자가 확인 후 처리해드립니다.' },
          { name: '✅ 티켓 생성 가능 사유', value: '• 💬 길드 가입 신청\n• ❓ 문의사항\n• 💡 건의사항\n• 🚨 신고' }
        )
        .setImage('https://imgur.com/LO32omi.png')
        .setTimestamp()
        .setFooter({ text: '🎷Blues', iconURL: interaction.guild.iconURL() });
      
      // 버튼 생성
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('create_ticket')
            .setLabel('🎫 티켓 생성')
            .setStyle(ButtonStyle.Primary)
        );
      
      // 채널에 임베드 전송
      await channel.send({ embeds: [ticketEmbed], components: [row] });
      
      // 성공 메시지 전송
      await interaction.editReply({
        content: `✅ 티켓 임베드가 <#${channel.id}> 채널에 성공적으로 전송되었습니다!`,
        ephemeral: true
      });
      
      logger.success(this.name, `티켓 임베드가 ${channel.name} 채널에 전송되었습니다.`);
    }
  
    /**
     * 티켓 카테고리 설정 명령어 처리
     * @param {Interaction} interaction 상호작용 객체
     */
    async handleTicketCategory(interaction) {
      const category = interaction.options.getChannel('카테고리');
      
      // 카테고리 타입 확인
      if (category.type !== ChannelType.GuildCategory) {
        return interaction.reply({
          content: '❌ 선택한 채널이 카테고리가 아닙니다!',
          ephemeral: true
        });
      }
      
      // 설정 업데이트
      config.updateModuleConfig(this.name, { ticketCategoryId: category.id });
      
      await interaction.reply({
        content: `✅ 티켓 생성 카테고리가 \`${category.name}\`으로 설정되었습니다.`,
        ephemeral: true
      });
      
      logger.success(this.name, `티켓 생성 카테고리가 ${category.name}으로 설정되었습니다.`);
    }
  
    /**
     * 관리자 역할 설정 명령어 처리
     * @param {Interaction} interaction 상호작용 객체
     */
    async handleAdminRole(interaction) {
      const role = interaction.options.getRole('역할');
      
      // 설정 업데이트
      config.updateModuleConfig(this.name, { adminRoleId: role.id });
      
      await interaction.reply({
        content: `✅ 티켓 관리자 역할이 \`${role.name}\`으로 설정되었습니다.`,
        ephemeral: true
      });
      
      logger.success(this.name, `티켓 관리자 역할이 ${role.name}으로 설정되었습니다.`);
    }
  
    /**
     * 가입 신청서 보관 채널 설정 명령어 처리
     * @param {Interaction} interaction 상호작용 객체
     */
    async handleApplicationChannel(interaction) {
      const channel = interaction.options.getChannel('채널');
      
      // 채널 타입 확인
      if (channel.type !== ChannelType.GuildText) {
        return interaction.reply({
          content: '❌ 선택한 채널이 텍스트 채널이 아닙니다!',
          ephemeral: true
        });
      }
      
      // 채널 권한 확인
      if (!channel.viewable || !channel.permissionsFor(interaction.guild.members.me).has(['SendMessages', 'AttachFiles'])) {
        return interaction.reply({
          content: '❌ 선택한 채널에 메시지를 보내거나 파일을 첨부할 권한이 없습니다!',
          ephemeral: true
        });
      }
      
      // 설정 업데이트
      config.updateModuleConfig(this.name, { applicationChannelId: channel.id });
      
      await interaction.reply({
        content: `✅ 가입 신청서 보관 채널이 <#${channel.id}>로 설정되었습니다.`,
        ephemeral: true
      });
      
      logger.success(this.name, `가입 신청서 보관 채널이 ${channel.name}으로 설정되었습니다.`);
    }
  
    /**
     * 모듈 이벤트 리스너 등록
     */
    registerEvents() {
      // 버튼 클릭 이벤트 리스너
      this.client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isButton()) return;
        
        // 티켓 관련 버튼 처리
        if (interaction.customId === 'create_ticket') {
          await this.handleCreateTicket(interaction);
        } else if (interaction.customId === 'guild_rules') {
          await this.handleGuildRules(interaction);
        } else if (interaction.customId === 'application_form') {
          await this.handleApplicationForm(interaction);
        } else if (interaction.customId === 'call_admin') {
          await this.handleCallAdmin(interaction);
        } else if (interaction.customId === 'close_ticket') {
          await this.handleCloseTicket(interaction);
        } else if (interaction.customId === 'agree_rules') {
          await this.handleRulesAgreement(interaction);
        } else if (interaction.customId === 'approve_application') {
          await this.handleApproveApplication(interaction);
        } else if (interaction.customId === 'reject_application') {
          await this.handleRejectApplication(interaction);
        } else if (interaction.customId === 'save_transcript') {
          await this.handleSaveTranscript(interaction);
        } else if (interaction.customId === 'skip_transcript') {
          await this.handleSkipTranscript(interaction);
        }
      });
      
      // 모달 제출 이벤트 리스너
      this.client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isModalSubmit()) return;
        
        // 모달 제출 처리
        if (interaction.customId === 'application_modal') {
          await this.handleApplicationSubmit(interaction);
        } else if (interaction.customId === 'rejection_modal') {
          await this.handleRejectionSubmit(interaction);
        }
      });
      
      logger.success(this.name, '티켓 모듈 이벤트 리스너가 등록되었습니다.');
    }
  
    /**
     * 티켓 생성 버튼 클릭 처리
     * @param {ButtonInteraction} interaction 버튼 상호작용 객체
     */
    async handleCreateTicket(interaction) {
      await interaction.deferReply({ ephemeral: true });
      
      try {
        // 설정 확인
        const ticketCategoryId = config.get(`modules.${this.name}.ticketCategoryId`);
        if (!ticketCategoryId) {
          return interaction.editReply({
            content: '❌ 티켓 카테고리가 설정되지 않았습니다. 관리자에게 문의해주세요.',
            ephemeral: true
          });
        }
        
        const category = interaction.guild.channels.cache.get(ticketCategoryId);
        if (!category) {
          return interaction.editReply({
            content: '❌ 설정된 티켓 카테고리를 찾을 수 없습니다. 관리자에게 문의해주세요.',
            ephemeral: true
          });
        }
        
        const adminRoleId = config.get(`modules.${this.name}.adminRoleId`);
        if (!adminRoleId) {
          return interaction.editReply({
            content: '❌ 관리자 역할이 설정되지 않았습니다. 관리자에게 문의해주세요.',
            ephemeral: true
          });
        }
        
        const adminRole = interaction.guild.roles.cache.get(adminRoleId);
        if (!adminRole) {
          return interaction.editReply({
            content: '❌ 설정된 관리자 역할을 찾을 수 없습니다. 관리자에게 문의해주세요.',
            ephemeral: true
          });
        }
        
        // 사용자가 이미 티켓을 생성했는지 확인
        const existingTicket = interaction.guild.channels.cache.find(
          c => c.name.includes(`티켓-${interaction.user.username.toLowerCase()}`) && 
               c.parentId === ticketCategoryId
        );
        
        if (existingTicket) {
          return interaction.editReply({
            content: `❌ 이미 생성된 티켓이 있습니다: <#${existingTicket.id}>`,
            ephemeral: true
          });
        }
        
        // 티켓 채널 생성
        const ticketChannel = await interaction.guild.channels.create({
          name: `🎫-${interaction.user.username}님의-티켓`,
          type: ChannelType.GuildText,
          parent: category,
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: interaction.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
              ]
            },
            {
              id: adminRole.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages
              ]
            },
            {
              id: interaction.client.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.AttachFiles
              ]
            }
          ]
        });
        
        // 티켓 생성 완료 임베드
        const successEmbed = new EmbedBuilder()
          .setColor('#43B581')
          .setTitle('✅ 티켓 생성 완료')
          .setAuthor({ name: 'Aimbot.ad', iconURL: 'https://imgur.com/Sd8qK9c.gif' })
          .setDescription('티켓이 성공적으로 생성되었습니다!')
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: '🔗 티켓 채널', value: `<#${ticketChannel.id}>` }
          )
          .setImage('https://imgur.com/LO32omi.png')
          .setTimestamp()
          .setFooter({ text: '🎷Blues', iconURL: interaction.guild.iconURL() });
        
        await interaction.editReply({ embeds: [successEmbed] });
        
        // 티켓 채널에 초기 메시지 전송
        const welcomeEmbed = new EmbedBuilder()
          .setColor('#3498db')
          .setTitle('🎫 새 티켓이 생성되었습니다')
          .setAuthor({ name: 'Aimbot.ad', iconURL: 'https://imgur.com/Sd8qK9c.gif' })
          .setDescription(`👤 <@${interaction.user.id}>님의 티켓입니다.\n🔒 디스코드 id: ${interaction.user.id}`)
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: '📌 중요 안내', value: '아래 버튼을 사용하여 원하는 작업을 진행하세요.\n문의가 완료되면 티켓 닫기를 선택해주세요.' },
            { name: '📜 길드 규칙', value: '길드 규칙을 확인하시고\n규칙에 동의해주세요.', inline: true },
            { name: '✏️ 가입 신청서', value: '신청서를 작성한 뒤\n관리자를 기다려주세요.', inline: true },
            { name: '🔔 관리자 호출', value: '관리자가 부재중일 경우\n호출 버튼을 사용해주세요.', inline: true }
          )
          .setImage('https://imgur.com/LO32omi.png')
          .setTimestamp()
          .setFooter({ text: '🎷Blues', iconURL: interaction.guild.iconURL() });
        
        // 버튼 생성
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('guild_rules')
              .setLabel('📜 길드 규칙')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('application_form')
              .setLabel('✏️ 가입 신청서')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('call_admin')
              .setLabel('🔔 관리자 호출')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('close_ticket')
              .setLabel('티켓 닫기')
              .setStyle(ButtonStyle.Danger)
          );
        
        // 티켓 채널에 메시지 전송 및 사용자 멘션
        await ticketChannel.send({ content: `<@${interaction.user.id}>님, 티켓이 생성되었습니다!` });
        await ticketChannel.send({ embeds: [welcomeEmbed], components: [row] });
        
        logger.success(this.name, `${interaction.user.tag}님의 티켓이 생성되었습니다: ${ticketChannel.name}`);
      } catch (error) {
        logger.error(this.name, `티켓 생성 중 오류 발생: ${error.message}`);
        await interaction.editReply({
          content: `❌ 티켓 생성 중 오류가 발생했습니다: ${error.message}`,
          ephemeral: true
        });
      }
    }
  
    /**
     * 길드 규칙 버튼 클릭 처리
     * @param {ButtonInteraction} interaction 버튼 상호작용 객체
     */
    async handleGuildRules(interaction) {
      try {
        const rulesEmbed = new EmbedBuilder()
          .setColor('#3498db')
          .setTitle('📜 길드 규칙')
          .setAuthor({ name: 'Aimbot.ad', iconURL: 'https://imgur.com/Sd8qK9c.gif' })
          .setDescription('블루스 규칙 블루스 길드의 규칙입니다. 가입 전에 자세히 읽어주시고 숙지해주세요!')
          .addFields(
            { name: '(1) 길드 운영 지침', value: 
              '1. 블루스는 만 19세 이상 성인길드입니다.\n' +
              '2. 길드 디스코드 가입은 필수입니다. 단, 길드 단톡 가입은 선택사항입니다.\n' +
              '3. 미접속 14일(2주)일 경우 탈퇴처리가 기본 원칙입니다. 단, 미접속게시판에 사유를 남겨주시면 정상참작해서 탈퇴처리를 보류합니다.\n' +
              '4. 길드 생활 중 불화가 있을 경우, 사안의 경중에 따라 경고 또는 탈퇴처리를 할 수 있습니다.(자세한 사항은 공지사항에 있는 블루스 내규를 확인해주세요.)\n' +
              '5. 이중길드는 원칙적으로 금지합니다.'
            },
            { name: '(2) 길드 생활 지침', value: 
              '1. 길드원간 기본적인 매너와 예의를 지켜주세요.\n' +
              '2. 각 길드원의 플레이스타일과, 취향, 성향을 존중해주세요.\n' +
              '3. 험담, 욕설 등을 자제해주세요.\n' +
              '4. 남미새, 여미새, 핑프족, 논란있는 커뮤 사용자는 길드원으로 거부합니다.\n' +
              '5. 사사게 이력이 있으신 분은 길드원으로 거부합니다.\n' +
              '6. 길드 생활 중 문제나 어려움이 생겼을 시에 임원에게 먼저 상담해주세요.\n' +
              '7. 길드 공지사항에 있는 내용들을 잘 확인해주세요.\n' +
              '8. 길드 규칙에 동의하신다면 아래의 버튼을 눌러주세요.'
            }
          )
          .setTimestamp()
          .setFooter({ text: '🎷Blues', iconURL: interaction.guild.iconURL() });
        
        // 규칙 동의 버튼
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('agree_rules')
              .setLabel('규칙에 동의합니다')
              .setStyle(ButtonStyle.Success)
          );
        
        await interaction.reply({ embeds: [rulesEmbed], components: [row], ephemeral: false });
        logger.info(this.name, `${interaction.user.tag}님이 길드 규칙을 확인했습니다.`);
      } catch (error) {
        logger.error(this.name, `길드 규칙 표시 중 오류 발생: ${error.message}`);
        await interaction.reply({
          content: '❌ 길드 규칙을 표시하는 중 오류가 발생했습니다.',
          ephemeral: true
        });
      }
    }
  
    /**
     * 길드 규칙 동의 버튼 클릭 처리
     * @param {ButtonInteraction} interaction 버튼 상호작용 객체
     */
    async handleRulesAgreement(interaction) {
      try {
        const agreeEmbed = new EmbedBuilder()
          .setColor('#43B581')
          .setTitle('✅ 규칙 동의 완료')
          .setDescription(`<@${interaction.user.id}>님이 길드 규칙에 동의하셨습니다.`)
          .setTimestamp()
          .setFooter({ text: '🎷Blues', iconURL: interaction.guild.iconURL() });
        
        await interaction.reply({ embeds: [agreeEmbed] });
        logger.info(this.name, `${interaction.user.tag}님이 길드 규칙에 동의했습니다.`);
      } catch (error) {
        logger.error(this.name, `규칙 동의 처리 중 오류 발생: ${error.message}`);
        await interaction.reply({
          content: '❌ 규칙 동의 처리 중 오류가 발생했습니다.',
          ephemeral: true
        });
      }
    }
  
    /**
     * 가입 신청서 버튼 클릭 처리
     * @param {ButtonInteraction} interaction 버튼 상호작용 객체
     */
    async handleApplicationForm(interaction) {
      try {
        // 모달 생성
        const modal = new ModalBuilder()
          .setCustomId('application_modal')
          .setTitle('블루스 길드 가입 신청서');
        
        // 신청서 입력 필드 생성
        const sourceInput = new TextInputBuilder()
          .setCustomId('source')
          .setLabel('블루스를 알게 되신 경로를 알려주세요.')
          .setPlaceholder('예: 거뿔/마도카/공홈/지인추천 등')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        
        const characterNameInput = new TextInputBuilder()
          .setCustomId('characterName')
          .setLabel('캐릭터명을 알려주세요.')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        
        const genderAgeInput = new TextInputBuilder()
          .setCustomId('genderAge')
          .setLabel('성별과 나이대를 알려주세요.')
          .setPlaceholder('해당 정보는 임원들에게만 알립니다')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        
        const playTimeInput = new TextInputBuilder()
          .setCustomId('playTime')
          .setLabel('마비노기를 플레이한지 얼마 정도 되셨나요?')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        
        const infoInput = new TextInputBuilder()
          .setCustomId('info')
          .setLabel('현재 누렙과 주아르카나를 알려주세요.')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        
        // 모달에 입력 필드 추가
        const row1 = new ActionRowBuilder().addComponents(sourceInput);
        const row2 = new ActionRowBuilder().addComponents(characterNameInput);
        const row3 = new ActionRowBuilder().addComponents(genderAgeInput);
        const row4 = new ActionRowBuilder().addComponents(playTimeInput);
        const row5 = new ActionRowBuilder().addComponents(infoInput);
        
        modal.addComponents(row1, row2, row3, row4, row5);
        
        // 모달 표시
        await interaction.showModal(modal);
        logger.info(this.name, `${interaction.user.tag}님이 가입 신청서 모달을 열었습니다.`);
      } catch (error) {
        logger.error(this.name, `가입 신청서 모달 표시 중 오류 발생: ${error.message}`);
        await interaction.reply({
          content: '❌ 가입 신청서를 표시하는 중 오류가 발생했습니다.',
          ephemeral: true
        });
      }
    }
  
    /**
     * 가입 신청서 모달 제출 처리
     * @param {ModalSubmitInteraction} interaction 모달 제출 상호작용 객체
     */
    async handleApplicationSubmit(interaction) {
      try {
        await interaction.deferReply();
        
        // 모달에서 입력 값 추출
        const source = interaction.fields.getTextInputValue('source');
        const characterName = interaction.fields.getTextInputValue('characterName');
        const genderAge = interaction.fields.getTextInputValue('genderAge');
        const playTime = interaction.fields.getTextInputValue('playTime');
        const info = interaction.fields.getTextInputValue('info');
        
        // 가입 신청서 보관 채널 확인
        const applicationChannelId = config.get(`modules.${this.name}.applicationChannelId`);
        const applicationChannel = applicationChannelId ? 
          interaction.guild.channels.cache.get(applicationChannelId) : null;
        
        // 관리자 역할 확인
        const adminRoleId = config.get(`modules.${this.name}.adminRoleId`);
        
        // 가입 신청서 임베드 생성
        const applicationEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('📝 길드 가입 신청서')
          .setAuthor({ name: 'Aimbot.ad', iconURL: 'https://imgur.com/Sd8qK9c.gif' })
          .setDescription(`<@${interaction.user.id}>님의 가입 신청서입니다.`)
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: '블루스를 알게 된 경로', value: source },
            { name: '캐릭터명', value: characterName },
            { name: '성별과 나이대', value: genderAge },
            { name: '플레이 기간', value: playTime },
            { name: '누렙과 주아르카나', value: info },
            { name: '신청 상태', value: '⏳ 검토 중', inline: true },
            { name: '처리자', value: '없음', inline: true }
          )
          .setTimestamp()
          .setFooter({ text: '🎷Blues', iconURL: interaction.guild.iconURL() });
        
        // 버튼 생성 (관리자용)
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('approve_application')
              .setLabel('승인')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('reject_application')
              .setLabel('거부')
              .setStyle(ButtonStyle.Danger)
          );
        
        // 티켓 채널에 신청서 전송
        const ticketMessage = await interaction.reply({
          embeds: [applicationEmbed],
          components: [row]
        });
        
        // 신청서 보관 채널이 설정되어 있으면 해당 채널에도 전송
        if (applicationChannel) {
          const archiveMessage = await applicationChannel.send({
            embeds: [applicationEmbed],
            components: [row]
          });
          
          // 메시지 ID 저장 (나중에 업데이트를 위해)
          this.saveMessageIds(interaction.channel.id, interaction.user.id, ticketMessage.id, archiveMessage.id);
          
          logger.info(this.name, `${interaction.user.tag}님의 가입 신청서가 보관되었습니다.`);
        }
        
        // 관리자에게 알림
        if (adminRoleId) {
          await interaction.channel.send({
            content: `<@&${adminRoleId}> 새로운 가입 신청서가 제출되었습니다.`,
            allowedMentions: { roles: [adminRoleId] }
          });
        }
        
        logger.success(this.name, `${interaction.user.tag}님이 가입 신청서를 제출했습니다.`);
      } catch (error) {
        logger.error(this.name, `가입 신청서 처리 중 오류 발생: ${error.message}`);
        
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({
            content: '❌ 가입 신청서 처리 중 오류가 발생했습니다.',
            ephemeral: true
          });
        } else {
          await interaction.reply({
            content: '❌ 가입 신청서 처리 중 오류가 발생했습니다.',
            ephemeral: true
          });
        }
      }
    }
  
    /**
     * 메시지 ID 저장 (임시 저장)
     * @param {string} channelId 채널 ID
     * @param {string} userId 사용자 ID
     * @param {string} ticketMessageId 티켓 채널 메시지 ID
     * @param {string} archiveMessageId 보관 채널 메시지 ID
     */
    saveMessageIds(channelId, userId, ticketMessageId, archiveMessageId) {
      if (!this.messageMap) this.messageMap = new Map();
      
      this.messageMap.set(`${channelId}-${userId}`, {
        ticketMessageId,
        archiveMessageId
      });
    }
  
    /**
     * 가입 신청서 승인 처리
     * @param {ButtonInteraction} interaction 버튼 상호작용 객체
     */
    async handleApproveApplication(interaction) {
      // 관리자 권한 확인
      const adminRoleId = config.get(`modules.${this.name}.adminRoleId`);
      if (!adminRoleId || !interaction.member.roles.cache.has(adminRoleId)) {
        return interaction.reply({
          content: '❌ 이 작업은 관리자만 수행할 수 있습니다.',
          ephemeral: true
        });
      }
      
      try {
        await interaction.deferUpdate();
        
        // 원본 임베드 가져오기
        const message = await interaction.message.fetch();
        const originalEmbed = message.embeds[0];
        
        if (!originalEmbed) {
          return interaction.followUp({
            content: '❌ 신청서 정보를 찾을 수 없습니다.',
            ephemeral: true
          });
        }
        
        // 사용자 ID 추출
        const userMention = originalEmbed.description.match(/<@(\d+)>/);
        const userId = userMention ? userMention[1] : null;
        
        if (!userId) {
          return interaction.followUp({
            content: '❌ 신청자 정보를 찾을 수 없습니다.',
            ephemeral: true
          });
        }
        
        // 업데이트된 임베드 생성
        const updatedEmbed = EmbedBuilder.from(originalEmbed)
          .setColor('#43B581')
          .spliceFields(originalEmbed.fields.length - 2, 2, 
            { name: '신청 상태', value: '✅ 승인됨', inline: true },
            { name: '처리자', value: interaction.user.tag, inline: true }
          );
        
        // 버튼 비활성화
        const disabledRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('approve_application')
              .setLabel('승인됨')
              .setStyle(ButtonStyle.Success)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('reject_application')
              .setLabel('거부')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true)
          );
        
        // 메시지 업데이트
        await interaction.message.edit({
          embeds: [updatedEmbed],
          components: [disabledRow]
        });
        
        // 보관 채널의 메시지도 업데이트
        const applicationChannelId = config.get(`modules.${this.name}.applicationChannelId`);
        if (applicationChannelId && this.messageMap?.get(`${interaction.channelId}-${userId}`)) {
          const applicationChannel = interaction.guild.channels.cache.get(applicationChannelId);
          const { archiveMessageId } = this.messageMap.get(`${interaction.channelId}-${userId}`);
          
          try {
            const archiveMessage = await applicationChannel.messages.fetch(archiveMessageId);
            await archiveMessage.edit({
              embeds: [updatedEmbed],
              components: [disabledRow]
            });
          } catch (error) {
            logger.warn(this.name, `보관 메시지 업데이트 실패: ${error.message}`);
          }
        }
        
        // 승인 알림
        const approvalEmbed = new EmbedBuilder()
          .setColor('#43B581')
          .setTitle('✅ 가입 신청 승인')
          .setDescription(`<@${userId}>님의 가입 신청이 승인되었습니다!`)
          .addFields(
            { name: '처리자', value: interaction.user.tag },
            { name: '승인 시간', value: new Date().toLocaleString('ko-KR') }
          )
          .setTimestamp()
          .setFooter({ text: '🎷Blues', iconURL: interaction.guild.iconURL() });
        
        await interaction.followUp({ embeds: [approvalEmbed] });
        
        logger.success(this.name, `${interaction.user.tag}님이 가입 신청을 승인했습니다.`);
      } catch (error) {
        logger.error(this.name, `가입 신청 승인 중 오류 발생: ${error.message}`);
        await interaction.followUp({
          content: '❌ 가입 신청 승인 중 오류가 발생했습니다.',
          ephemeral: true
        });
      }
    }
  
    /**
     * 가입 신청서 거부 처리
     * @param {ButtonInteraction} interaction 버튼 상호작용 객체
     */
    async handleRejectApplication(interaction) {
      // 관리자 권한 확인
      const adminRoleId = config.get(`modules.${this.name}.adminRoleId`);
      if (!adminRoleId || !interaction.member.roles.cache.has(adminRoleId)) {
        return interaction.reply({
          content: '❌ 이 작업은 관리자만 수행할 수 있습니다.',
          ephemeral: true
        });
      }
      
      try {
        // 거부 사유 모달 생성
        const rejectionModal = new ModalBuilder()
          .setCustomId('rejection_modal')
          .setTitle('가입 신청 거부 사유');
        
        const reasonInput = new TextInputBuilder()
          .setCustomId('rejectionReason')
          .setLabel('거부 사유')
          .setPlaceholder('가입을 거부하는 사유를 작성해주세요.')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);
        
        const row = new ActionRowBuilder().addComponents(reasonInput);
        rejectionModal.addComponents(row);
        
        // 모달 표시
        await interaction.showModal(rejectionModal);
      } catch (error) {
        logger.error(this.name, `거부 모달 표시 중 오류 발생: ${error.message}`);
        await interaction.reply({
          content: '❌ 거부 사유 입력 모달을 표시하는 중 오류가 발생했습니다.',
          ephemeral: true
        });
      }
    }
  
    /**
     * 거부 사유 모달 제출 처리
     * @param {ModalSubmitInteraction} interaction 모달 제출 상호작용 객체
     */
    async handleRejectionSubmit(interaction) {
      try {
        await interaction.deferUpdate();
        
        // 거부 사유 가져오기
        const rejectionReason = interaction.fields.getTextInputValue('rejectionReason');
        
        // 원본 임베드 가져오기
        const message = await interaction.message.fetch();
        const originalEmbed = message.embeds[0];
        
        if (!originalEmbed) {
          return interaction.followUp({
            content: '❌ 신청서 정보를 찾을 수 없습니다.',
            ephemeral: true
          });
        }
        
        // 사용자 ID 추출
        const userMention = originalEmbed.description.match(/<@(\d+)>/);
        const userId = userMention ? userMention[1] : null;
        
        if (!userId) {
          return interaction.followUp({
            content: '❌ 신청자 정보를 찾을 수 없습니다.',
            ephemeral: true
          });
        }
        
        // 업데이트된 임베드 생성
        const updatedEmbed = EmbedBuilder.from(originalEmbed)
          .setColor('#F04747')
          .spliceFields(originalEmbed.fields.length - 2, 2,
            { name: '신청 상태', value: '❌ 거부됨', inline: true },
            { name: '처리자', value: interaction.user.tag, inline: true },
            { name: '거부 사유', value: rejectionReason }
          );
        
        // 버튼 비활성화
        const disabledRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('approve_application')
              .setLabel('승인')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('reject_application')
              .setLabel('거부됨')
              .setStyle(ButtonStyle.Danger)
              .setDisabled(true)
          );
        
        // 메시지 업데이트
        await interaction.message.edit({
          embeds: [updatedEmbed],
          components: [disabledRow]
        });
        
        // 보관 채널의 메시지도 업데이트
        const applicationChannelId = config.get(`modules.${this.name}.applicationChannelId`);
        if (applicationChannelId && this.messageMap?.get(`${interaction.channelId}-${userId}`)) {
          const applicationChannel = interaction.guild.channels.cache.get(applicationChannelId);
          const { archiveMessageId } = this.messageMap.get(`${interaction.channelId}-${userId}`);
          
          try {
            const archiveMessage = await applicationChannel.messages.fetch(archiveMessageId);
            await archiveMessage.edit({
              embeds: [updatedEmbed],
              components: [disabledRow]
            });
          } catch (error) {
            logger.warn(this.name, `보관 메시지 업데이트 실패: ${error.message}`);
          }
        }
        
        // 거부 알림
        const rejectionEmbed = new EmbedBuilder()
          .setColor('#F04747')
          .setTitle('❌ 가입 신청 거부')
          .setDescription(`<@${userId}>님의 가입 신청이 거부되었습니다.`)
          .addFields(
            { name: '처리자', value: interaction.user.tag },
            { name: '거부 시간', value: new Date().toLocaleString('ko-KR') },
            { name: '거부 사유', value: rejectionReason }
          )
          .setTimestamp()
          .setFooter({ text: '🎷Blues', iconURL: interaction.guild.iconURL() });
        
        await interaction.followUp({ embeds: [rejectionEmbed] });
        
        logger.success(this.name, `${interaction.user.tag}님이 가입 신청을 거부했습니다.`);
      } catch (error) {
        logger.error(this.name, `가입 신청 거부 중 오류 발생: ${error.message}`);
        await interaction.followUp({
          content: '❌ 가입 신청 거부 중 오류가 발생했습니다.',
          ephemeral: true
        });
      }
    }
  
    /**
     * 관리자 호출 버튼 클릭 처리
     * @param {ButtonInteraction} interaction 버튼 상호작용 객체
     */
    async handleCallAdmin(interaction) {
      try {
        // 관리자 역할 확인
        const adminRoleId = config.get(`modules.${this.name}.adminRoleId`);
        if (!adminRoleId) {
          return interaction.reply({
            content: '❌ 관리자 역할이 설정되지 않았습니다.',
            ephemeral: true
          });
        }
        
        // 호출 임베드 생성
        const callEmbed = new EmbedBuilder()
          .setColor('#FF9900')
          .setTitle('🔔 관리자 호출')
          .setDescription(`<@${interaction.user.id}>님이 관리자를 호출했습니다.`)
          .setTimestamp()
          .setFooter({ text: '🎷Blues', iconURL: interaction.guild.iconURL() });
        
        await interaction.reply({
          content: `<@&${adminRoleId}>`,
          embeds: [callEmbed],
          allowedMentions: { roles: [adminRoleId] }
        });
        
        logger.info(this.name, `${interaction.user.tag}님이 관리자를 호출했습니다.`);
      } catch (error) {
        logger.error(this.name, `관리자 호출 중 오류 발생: ${error.message}`);
        await interaction.reply({
          content: '❌ 관리자 호출 중 오류가 발생했습니다.',
          ephemeral: true
        });
      }
    }
  
    /**
     * 티켓 닫기 버튼 클릭 처리
     * @param {ButtonInteraction} interaction 버튼 상호작용 객체
     */
    async handleCloseTicket(interaction) {
      try {
        // 티켓 닫기 임베드 생성
        const closeEmbed = new EmbedBuilder()
          .setColor('#F04747')
          .setTitle('🔒 티켓 닫기')
          .setDescription('이 티켓은 5초 후에 닫힙니다.')
          .setTimestamp()
          .setFooter({ text: '🎷Blues', iconURL: interaction.guild.iconURL() });
        
        // 대화 내용 첨부 버튼
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('save_transcript')
              .setLabel('대화 내용 저장')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('skip_transcript')
              .setLabel('저장 없이 닫기')
              .setStyle(ButtonStyle.Secondary)
          );
        
        await interaction.reply({ embeds: [closeEmbed], components: [row] });
        
        // 자동으로 닫히지 않도록 변경 (버튼으로 선택)
      } catch (error) {
        logger.error(this.name, `티켓 닫기 중 오류 발생: ${error.message}`);
        await interaction.reply({
          content: '❌ 티켓 닫기 중 오류가 발생했습니다.',
          ephemeral: true
        });
      }
    }
  
    /**
     * 대화 내용 저장 버튼 클릭 처리
     * @param {ButtonInteraction} interaction 버튼 상호작용 객체
     */
    async handleSaveTranscript(interaction) {
      try {
        await interaction.deferUpdate();
        
        // 가입 신청서 보관 채널 확인
        const applicationChannelId = config.get(`modules.${this.name}.applicationChannelId`);
        if (!applicationChannelId) {
          await interaction.followUp({
            content: '❌ 보관 채널이 설정되지 않았습니다.',
            ephemeral: true
          });
          return this.closeTicketChannel(interaction.channel);
        }
        
        const applicationChannel = interaction.guild.channels.cache.get(applicationChannelId);
        if (!applicationChannel) {
          await interaction.followUp({
            content: '❌ 보관 채널을 찾을 수 없습니다.',
            ephemeral: true
          });
          return this.closeTicketChannel(interaction.channel);
        }
        
        // 대화 내용 가져오기
        await interaction.followUp({
          content: '💾 대화 내용을 저장 중입니다...',
          ephemeral: false
        });
        
        const transcript = await this.createTranscript(interaction.channel);
        
        // 대화 내용 파일로 저장
        const buffer = Buffer.from(transcript, 'utf-8');
        const fileName = `transcript-${interaction.channel.name}-${Date.now()}.txt`;
        
        // 파일 첨부
        await applicationChannel.send({
          content: `📝 티켓 **${interaction.channel.name}**의 대화 내용입니다.`,
          files: [{ attachment: buffer, name: fileName }]
        });
        
        await interaction.followUp({
          content: '✅ 대화 내용이 성공적으로 저장되었습니다.',
          ephemeral: false
        });
        
        // 티켓 채널 닫기
        setTimeout(() => this.closeTicketChannel(interaction.channel), 2000);
        
        logger.success(this.name, `${interaction.user.tag}님이 티켓 대화 내용을 저장했습니다.`);
      } catch (error) {
        logger.error(this.name, `대화 내용 저장 중 오류 발생: ${error.message}`);
        await interaction.followUp({
          content: '❌ 대화 내용 저장 중 오류가 발생했습니다.',
          ephemeral: true
        });
        
        // 오류가 발생해도 티켓 채널은 닫기
        setTimeout(() => this.closeTicketChannel(interaction.channel), 2000);
      }
    }
  
    /**
     * 저장 없이 닫기 버튼 클릭 처리
     * @param {ButtonInteraction} interaction 버튼 상호작용 객체
     */
    async handleSkipTranscript(interaction) {
      try {
        await interaction.deferUpdate();
        
        await interaction.followUp({
          content: '🔒 대화 내용을 저장하지 않고 티켓을 닫습니다.',
          ephemeral: false
        });
        
        // 티켓 채널 닫기
        setTimeout(() => this.closeTicketChannel(interaction.channel), 2000);
        
        logger.info(this.name, `${interaction.user.tag}님이 대화 내용을 저장하지 않고 티켓을 닫았습니다.`);
      } catch (error) {
        logger.error(this.name, `티켓 닫기 중 오류 발생: ${error.message}`);
        
        // 오류가 발생해도 티켓 채널은 닫기
        setTimeout(() => this.closeTicketChannel(interaction.channel), 2000);
      }
    }
  
    /**
     * 티켓 채널 닫기
     * @param {TextChannel} channel 티켓 채널
     */
    async closeTicketChannel(channel) {
      try {
        await channel.delete();
        logger.success(this.name, `티켓 채널 ${channel.name}이(가) 삭제되었습니다.`);
      } catch (error) {
        logger.error(this.name, `티켓 채널 삭제 중 오류 발생: ${error.message}`);
      }
    }
  
    /**
     * 대화 내용 트랜스크립트 생성
     * @param {TextChannel} channel 티켓 채널
     * @returns {string} 트랜스크립트 텍스트
     */
    async createTranscript(channel) {
      let transcript = `=== 티켓: ${channel.name} ===\n`;
      transcript += `생성 시간: ${channel.createdAt.toLocaleString('ko-KR')}\n`;
      transcript += `서버: ${channel.guild.name}\n\n`;
      
      let lastMessageId = null;
      let allMessages = [];
      
      // 최대 500개 메시지 가져오기 (API 제한 때문에)
      try {
        let messagesLeft = true;
        
        while (messagesLeft) {
          const options = { limit: 100 };
          if (lastMessageId) options.before = lastMessageId;
          
          const messages = await channel.messages.fetch(options);
          
          if (messages.size === 0) {
            messagesLeft = false;
            break;
          }
          
          allMessages = [...allMessages, ...messages.values()];
          lastMessageId = messages.last().id;
          
          if (messages.size < 100) {
            messagesLeft = false;
          }
        }
        
        // 메시지 시간순으로 정렬
        allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        
        // 메시지 포맷팅
        for (const message of allMessages) {
          const timestamp = message.createdAt.toLocaleString('ko-KR');
          let content = message.content || '(내용 없음)';
          
          // 임베드가 있으면 설명 추가
          if (message.embeds.length > 0) {
            for (const embed of message.embeds) {
              if (embed.description) {
                content += `\n[임베드] ${embed.description}`;
              }
              
              if (embed.fields.length > 0) {
                for (const field of embed.fields) {
                  content += `\n[임베드 필드: ${field.name}] ${field.value}`;
                }
              }
            }
          }
          
          // 첨부 파일이 있으면 추가
          if (message.attachments.size > 0) {
            content += `\n[첨부 파일: ${message.attachments.size}개]`;
            message.attachments.forEach(attachment => {
              content += `\n- ${attachment.name}: ${attachment.url}`;
            });
          }
          
          transcript += `[${timestamp}] ${message.author.tag}: ${content}\n\n`;
        }
        
        return transcript;
      } catch (error) {
        logger.error(this.name, `트랜스크립트 생성 중 오류 발생: ${error.message}`);
        return `트랜스크립트 생성 중 오류가 발생했습니다: ${error.message}`;
      }
    }
  
    /**
     * 모듈을 시작합니다.
     */
    start() {
      if (this.enabled) {
        this.registerEvents();
        logger.success(this.name, '티켓 시스템 모듈이 활성화되었습니다.');
      } else {
        logger.warn(this.name, '티켓 시스템 모듈이 비활성화되어 있습니다.');
      }
      return this;
    }
  }
  
  module.exports = (client) => new TicketModule(client);