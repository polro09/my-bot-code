const { 
    EmbedBuilder, 
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder, 
    TextInputStyle,
    PermissionFlagsBits,
    Events
  } = require('discord.js');
  const logger = require('../logger');
  const config = require('../config/bot-config');
  const fs = require('fs').promises;
  const path = require('path');
  
  /**
   * 티켓 핸들러 모듈 클래스
   * 티켓 시스템의 추가 기능을 처리하는 모듈
   */
  class TicketHandlerModule {
    constructor(client) {
      this.client = client;
      this.name = 'ticket-handler';
      this.description = '티켓 시스템 핸들러 모듈';
      this.enabled = true;
      
      // 계속해서 작업할 티켓 목록 저장
      this.activeTickets = new Map();
      
      // 설정 초기화
      this.initConfig();
      
      logger.module(this.name, '티켓 핸들러 모듈이 초기화되었습니다.');
    }
    
    /**
     * 모듈 설정 초기화
     */
    initConfig() {
      // 티켓 모듈 설정 확인
      const ticketConfig = config.getModuleConfig('ticket');
      if (!ticketConfig) {
        logger.warn(this.name, '티켓 모듈 설정을 찾을 수 없습니다.');
      }
      
      this.enabled = config.get('modules.ticket.enabled', true);
    }
    
    /**
     * 여러 단계의 가입 신청서 설문을 처리하는 함수
     * (기존의 단일 모달로는 입력 필드 수 제한으로 인해 충분하지 않아 확장)
     * @param {ButtonInteraction} interaction 상호작용 객체
     */
    async handleExtendedApplicationForm(interaction) {
      try {
        // 기본 정보 모달
        const modal = new ModalBuilder()
          .setCustomId('application_extended_p1')
          .setTitle('블루스 길드 가입 신청서 (1/3)');  // 3단계로 변경
        
        // 첫 번째 페이지 입력 필드 구성
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
        
        const levelArcanInput = new TextInputBuilder()
          .setCustomId('levelArcan')
          .setLabel('현재 누렙과 주아르카나를 알려주세요.')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        
        // 모달에 입력 필드 추가
        const row1 = new ActionRowBuilder().addComponents(sourceInput);
        const row2 = new ActionRowBuilder().addComponents(characterNameInput);
        const row3 = new ActionRowBuilder().addComponents(genderAgeInput);
        const row4 = new ActionRowBuilder().addComponents(playTimeInput);
        const row5 = new ActionRowBuilder().addComponents(levelArcanInput);
        
        modal.addComponents(row1, row2, row3, row4, row5);
        
        // 티켓 정보 저장
        this.activeTickets.set(interaction.user.id, {
          channelId: interaction.channelId,
          step: 1,
          data: {}
        });
        
        // 모달 표시
        await interaction.showModal(modal);
        logger.info(this.name, `${interaction.user.tag}님이 확장 가입 신청서 모달을 열었습니다.`);
      } catch (error) {
        logger.error(this.name, `확장 가입 신청서 모달 표시 중 오류 발생: ${error.message}`);
        await interaction.reply({
          content: '❌ 가입 신청서를 표시하는 중 오류가 발생했습니다.',
          ephemeral: true
        });
      }
    }
    
    /**
     * 가입 신청서 첫 번째 단계 제출 처리
     * @param {ModalSubmitInteraction} interaction 모달 상호작용 객체
     */
    async handleExtendedApplicationPart1(interaction) {
      try {
        await interaction.deferReply({ ephemeral: true });
        
        // 티켓 정보 확인
        const ticketInfo = this.activeTickets.get(interaction.user.id);
        if (!ticketInfo) {
          return interaction.editReply({
            content: '❌ 티켓 정보를 찾을 수 없습니다. 다시 시도해주세요.',
            ephemeral: true
          });
        }
        
        // 첫 번째 단계 데이터 저장
        ticketInfo.data.source = interaction.fields.getTextInputValue('source');
        ticketInfo.data.characterName = interaction.fields.getTextInputValue('characterName');
        ticketInfo.data.genderAge = interaction.fields.getTextInputValue('genderAge');
        ticketInfo.data.playTime = interaction.fields.getTextInputValue('playTime');
        ticketInfo.data.levelArcan = interaction.fields.getTextInputValue('levelArcan');
        
        // 두 번째 페이지 모달 생성
        const modal = new ModalBuilder()
          .setCustomId('application_extended_p2')
          .setTitle('블루스 길드 가입 신청서 (2/3)');  // 3단계로 변경
        
        // 두 번째 페이지 입력 필드 구성
        const blronoInput = new TextInputBuilder()
          .setCustomId('blrono')
          .setLabel('블로니 추억담 3권까지 클리어 하셨나요?')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        
        const mainstreamInput = new TextInputBuilder()
          .setCustomId('mainstream')
          .setLabel('메인스트림 진행상황을 알려주세요.')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        
        const contentsInput = new TextInputBuilder()
          .setCustomId('contents')
          .setLabel('주로 하는 컨텐츠를 알려주세요.')
          .setPlaceholder('생활, 교역 or 주로 가는 던전 or 석상 등')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);
        
        const wantedContentsInput = new TextInputBuilder()
          .setCustomId('wantedContents')
          .setLabel('앞으로 하고 싶은 컨텐츠를 알려주세요.')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        
        const activeTimeInput = new TextInputBuilder()
          .setCustomId('activeTime')
          .setLabel('주로 접속/활동하는 시간을 알려주세요.')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        
        // 모달에 입력 필드 추가 (최대 5개까지만)
        const row1 = new ActionRowBuilder().addComponents(blronoInput);
        const row2 = new ActionRowBuilder().addComponents(mainstreamInput);
        const row3 = new ActionRowBuilder().addComponents(contentsInput);
        const row4 = new ActionRowBuilder().addComponents(wantedContentsInput);
        const row5 = new ActionRowBuilder().addComponents(activeTimeInput);
        
        modal.addComponents(row1, row2, row3, row4, row5);
        
        // 단계 업데이트
        ticketInfo.step = 2;
        this.activeTickets.set(interaction.user.id, ticketInfo);
        
        await interaction.editReply({
          content: '✅ 첫 번째 페이지가 완료되었습니다. 두 번째 페이지를 작성해주세요.',
          ephemeral: true
        });
        
        // 모달 표시
        await interaction.showModal(modal);
      } catch (error) {
        logger.error(this.name, `확장 가입 신청서 첫 번째 단계 처리 중 오류 발생: ${error.message}`);
        await interaction.editReply({
          content: '❌ 가입 신청서 처리 중 오류가 발생했습니다.',
          ephemeral: true
        });
      }
    }
    
    /**
     * 가입 신청서 두 번째 단계 제출 처리
     * @param {ModalSubmitInteraction} interaction 모달 상호작용 객체
     */
    async handleExtendedApplicationPart2(interaction) {
        try {
          await interaction.deferReply({ ephemeral: true });
        
          // 티켓 정보 확인
          const ticketInfo = this.activeTickets.get(interaction.user.id);
          if (!ticketInfo) {
            return interaction.editReply({
              content: '❌ 티켓 정보를 찾을 수 없습니다. 다시 시도해주세요.',
              ephemeral: true
            });
          }
        
        // 두 번째 단계 데이터 저장
      ticketInfo.data.blrono = interaction.fields.getTextInputValue('blrono');
      ticketInfo.data.mainstream = interaction.fields.getTextInputValue('mainstream');
      ticketInfo.data.contents = interaction.fields.getTextInputValue('contents');
      ticketInfo.data.wantedContents = interaction.fields.getTextInputValue('wantedContents');
      ticketInfo.data.activeTime = interaction.fields.getTextInputValue('activeTime');
      
      // 3단계 모달 (expectation)
      const modalStep3 = new ModalBuilder()
        .setCustomId('application_extended_p3')
        .setTitle('블루스 길드 가입 신청서 (3/3)');
      
      const expectationInput = new TextInputBuilder()
        .setCustomId('expectation')
        .setLabel('기대하는 길드활동이 있다면 알려주세요.')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);
      
      const rowExp = new ActionRowBuilder().addComponents(expectationInput);
      modalStep3.addComponents(rowExp);
      
      // 단계 업데이트
      ticketInfo.step = 3;
      this.activeTickets.set(interaction.user.id, ticketInfo);
      
      // 모달 표시 전에 메시지 표시
      await interaction.editReply({
        content: '✅ 두 번째 페이지가 완료되었습니다. 마지막 페이지가 곧 표시됩니다...',
        ephemeral: true
      });

      // 타이밍 문제 해결을 위해 setTimeout 사용 - 이 부분은 한 번만 실행되어야 함
      setTimeout(async () => {
        try {
          await interaction.showModal(modalStep3);
        } catch (modalError) {
          logger.error(this.name, `모달 표시 중 오류 발생: ${modalError.message}`);
          try {
            // 이미 응답한 인터랙션이므로 새 메시지 전송
            await interaction.followUp({
              content: '❌ 마지막 페이지를 표시하는 중 오류가 발생했습니다. 처음부터 다시 시도해주세요.',
              ephemeral: true
            });
          } catch (followUpError) {
            logger.error(this.name, `후속 메시지 전송 중 오류 발생: ${followUpError.message}`);
          }
        }
      }, 500);  // 0.5초 지연
      
    } catch (error) {
      logger.error(this.name, `확장 가입 신청서 두 번째 단계 처리 중 오류 발생: ${error.message}`);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ 가입 신청서 처리 중 오류가 발생했습니다.',
            ephemeral: true
          });
        } else {
          await interaction.followUp({
            content: '❌ 가입 신청서 처리 중 오류가 발생했습니다.',
            ephemeral: true
          });
        }
      } catch (replyError) {
        logger.error(this.name, `오류 응답 중 추가 오류 발생: ${replyError.message}`);
      }
    }
}
    
    /**
     * 가입 신청서 세 번째 단계 제출 처리
     * @param {ModalSubmitInteraction} interaction 모달 상호작용 객체
     */
    async handleExtendedApplicationPart3(interaction) {
      try {
        await interaction.deferReply();
        
        // 티켓 정보 확인
        const ticketInfo = this.activeTickets.get(interaction.user.id);
        if (!ticketInfo) {
          return interaction.editReply({
            content: '❌ 티켓 정보를 찾을 수 없습니다. 다시 시도해주세요.'
          });
        }
        
        // 세 번째 단계 데이터 저장
        ticketInfo.data.expectation = interaction.fields.getTextInputValue('expectation') || '없음';
        
        // 모든 데이터 수집 완료, 가입 신청서 생성
        
        // 가입 신청서 보관 채널 확인
        const applicationChannelId = config.get('modules.ticket.applicationChannelId');
        const applicationChannel = applicationChannelId ? 
          interaction.guild.channels.cache.get(applicationChannelId) : null;
        
        // 관리자 역할 확인
        const adminRoleId = config.get('modules.ticket.adminRoleId');
        
        // 가입 신청서 임베드 생성
        const applicationEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('📝 길드 가입 신청서')
          .setAuthor({ name: 'Aimbot.ad', iconURL: 'https://imgur.com/Sd8qK9c.gif' })
          .setDescription(`<@${interaction.user.id}>님의 가입 신청서입니다.`)
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: '블루스를 알게 된 경로', value: ticketInfo.data.source },
            { name: '캐릭터명', value: ticketInfo.data.characterName },
            { name: '성별과 나이대', value: ticketInfo.data.genderAge },
            { name: '플레이 기간', value: ticketInfo.data.playTime },
            { name: '누렙과 주아르카나', value: ticketInfo.data.levelArcan },
            { name: '블로니 추억담 3권 클리어 여부', value: ticketInfo.data.blrono },
            { name: '메인스트림 진행상황', value: ticketInfo.data.mainstream },
            { name: '주로 하는 컨텐츠', value: ticketInfo.data.contents },
            { name: '앞으로 하고 싶은 컨텐츠', value: ticketInfo.data.wantedContents },
            { name: '주 접속/활동 시간', value: ticketInfo.data.activeTime },
            { name: '기대하는 길드활동', value: ticketInfo.data.expectation },
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
        const ticketMessage = await interaction.editReply({
          content: '✅ 가입 신청서가 작성되었습니다!',
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
          this.saveMessageIds(ticketInfo.channelId, interaction.user.id, ticketMessage.id, archiveMessage.id);
        }
        
        // 관리자에게 알림
        if (adminRoleId) {
          await interaction.channel.send({
            content: `<@&${adminRoleId}> 새로운 가입 신청서가 제출되었습니다.`,
            allowedMentions: { roles: [adminRoleId] }
          });
        }
        
        // 티켓 정보 정리
        this.activeTickets.delete(interaction.user.id);
        
        logger.success(this.name, `${interaction.user.tag}님이 확장 가입 신청서를 완료했습니다.`);
      } catch (error) {
        logger.error(this.name, `확장 가입 신청서 마지막 단계 처리 중 오류 발생: ${error.message}`);
        await interaction.editReply({
          content: '❌ 가입 신청서 처리 중 오류가 발생했습니다.'
        });
      }
    }
    
    /**
     * 메시지 ID 저장 (업데이트를 위한 임시 저장)
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
     * 블로그 타입 가입 신청서 양식 생성
     * @param {ButtonInteraction} interaction 상호작용 객체
     */
    async handleApplicationFormBlog(interaction) {
      try {
        await interaction.deferReply();
        
        // 가입 신청서 템플릿 임베드
        const templateEmbed = new EmbedBuilder()
          .setColor('#3498db')
          .setTitle('📝 길드 가입 신청서 양식')
          .setAuthor({ name: 'Aimbot.ad', iconURL: 'https://imgur.com/Sd8qK9c.gif' })
          .setDescription('아래 양식을 복사하여 작성한 후, 이 채널에 붙여넣어 주세요.')
          .addFields(
            { name: '📋 양식', value: 
              '```md\n' +
              '# 블루스 길드 가입 신청서\n\n' +
              '1. 블루스를 알게 되신 경로를 알려주세요. (거뿔/마도카/공홈/지인추천 등)\n' +
              '2. 캐릭터명을 알려주세요.\n' +
              '3. 성별과 나이대를 알려주세요. (해당 정보는 임원들에게만 알립니다)\n' +
              '4. 마비노기를 플레이한지 얼마 정도 되셨나요?\n' +
              '5. 현재 누렙과 주아르카나를 알려주세요.\n' +
              '6. 블로니 추억담 3권까지 클리어 하셨나요?\n' +
              '7. 메인스트림 진행상황을 알려주세요.\n' +
              '8. 마비노기에서 주로 하는 컨텐츠를 알려주세요. (생활, 교역 or 주로 가는 던전 or 석상 등)\n' +
              '9. 앞으로 마비노기에서 하고 싶은 컨텐츠를 알려주세요.\n' +
              '10. 주로 접속/활동하는 시간을 알려주세요.\n' +
              '11. 기대하는 길드활동이 있다면 알려주세요.\n' +
              '```'
            }
          )
          .setTimestamp()
          .setFooter({ text: '🎷Blues', iconURL: interaction.guild.iconURL() });
        
        await interaction.editReply({
          embeds: [templateEmbed]
        });
        
        // 양식 작성 안내 메시지
        const guideEmbed = new EmbedBuilder()
          .setColor('#43B581')
          .setTitle('✏️ 신청서 작성 안내')
          .setDescription('위 양식을 복사하여 답변을 작성한 후, 이 채널에 메시지로 보내주세요.\n관리자가 확인 후 처리해드립니다.')
          .setTimestamp()
          .setFooter({ text: '🎷Blues', iconURL: interaction.guild.iconURL() });
        
        await interaction.followUp({
          embeds: [guideEmbed]
        });
        
        logger.info(this.name, `${interaction.user.tag}님이 블로그 형식의 가입 신청서 양식을 요청했습니다.`);
      } catch (error) {
        logger.error(this.name, `블로그 가입 신청서 양식 처리 중 오류 발생: ${error.message}`);
        await interaction.editReply({
          content: '❌ 가입 신청서 양식을 표시하는 중 오류가 발생했습니다.'
        });
      }
    }
    
    /**
     * 가입 신청서 텍스트 콘텐츠 감지 및 처리
     * @param {Message} message 메시지 객체
     */
    async detectAndProcessApplication(message) {
      try {
        // 봇 메시지는 무시
        if (message.author.bot) return;
        
        // 티켓 채널인지 확인
        if (!message.channel.name.includes('티켓')) return;
        
        // 긴 메시지인지 확인 (가입 신청서로 간주)
        if (message.content.length < 200) return;
        
        // 가입 신청서 패턴 확인
        const isApplication = 
          message.content.includes('가입 신청서') || 
          message.content.includes('블루스를 알게') ||
          message.content.includes('캐릭터명') ||
          (message.content.includes('1.') && message.content.includes('2.') && message.content.includes('3.'));
        
        if (!isApplication) return;
        
        logger.info(this.name, `${message.author.tag}님이 텍스트 형식의 가입 신청서를 제출했습니다.`);
        
        // 신청서 내용 파싱 및 구조화 시도
        const applicationData = this.parseApplicationText(message.content);
        
        // 가입 신청서 보관 채널 확인
        const applicationChannelId = config.get('modules.ticket.applicationChannelId');
        const applicationChannel = applicationChannelId ? 
          message.guild.channels.cache.get(applicationChannelId) : null;
        
        // 관리자 역할 확인
        const adminRoleId = config.get('modules.ticket.adminRoleId');
        
        // 가입 신청서 임베드 생성
        const applicationEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('📝 길드 가입 신청서')
          .setAuthor({ name: 'Aimbot.ad', iconURL: 'https://imgur.com/Sd8qK9c.gif' })
          .setDescription(`<@${message.author.id}>님의 가입 신청서입니다.`)
          .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
          .setTimestamp()
          .setFooter({ text: '🎷Blues', iconURL: message.guild.iconURL() });
        
        // 파싱된 데이터가 있으면 필드 추가
        if (applicationData && Object.keys(applicationData).length > 0) {
          for (const [key, value] of Object.entries(applicationData)) {
            if (value && value.trim()) {
              applicationEmbed.addFields({ name: key, value: value.trim() });
            }
          }
        } else {
          // 파싱 실패 시 원본 텍스트 추가
          const content = message.content.length > 1024 ? 
            message.content.substring(0, 1021) + '...' : message.content;
          
          applicationEmbed.addFields({ name: '원본 신청서', value: content });
        }
        
        // 상태 필드 추가
        applicationEmbed.addFields(
          { name: '신청 상태', value: '⏳ 검토 중', inline: true },
          { name: '처리자', value: '없음', inline: true }
        );
        
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
        
        // 티켓 채널에 구조화된 신청서 전송
        const ticketMessage = await message.channel.send({
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
          this.saveMessageIds(message.channel.id, message.author.id, ticketMessage.id, archiveMessage.id);
        }
        
        // 관리자에게 알림
        if (adminRoleId) {
          await message.channel.send({
            content: `<@&${adminRoleId}> 새로운 가입 신청서가 제출되었습니다.`,
            allowedMentions: { roles: [adminRoleId] }
          });
        }
        
        // 확인 메시지
        await message.reply({
          content: '✅ 가입 신청서가 성공적으로 접수되었습니다. 관리자가 검토 후 연락드리겠습니다.'
        });
        
        logger.success(this.name, `${message.author.tag}님의 텍스트 가입 신청서가 처리되었습니다.`);
      } catch (error) {
        logger.error(this.name, `텍스트 가입 신청서 처리 중 오류 발생: ${error.message}`);
        
        try {
          await message.reply({
            content: '❌ 가입 신청서 처리 중 오류가 발생했습니다. 관리자에게 문의해주세요.'
          });
        } catch (replyError) {
          logger.error(this.name, `오류 메시지 응답 실패: ${replyError.message}`);
        }
      }
    }
    
    /**
     * 텍스트 형식의 가입 신청서 파싱
     * @param {string} text 가입 신청서 텍스트
     * @returns {Object} 파싱된 데이터
     */
    parseApplicationText(text) {
        try {
          const result = {};
          
          // 번호 패턴으로 항목 구분 (예: 1. 답변)
          const numberPattern = /(\d+)[\.|\)]\s*(.*?)(?=(?:\n\d+[\.|\)])|$)/gs;
          const numberMatches = [...text.matchAll(numberPattern)];
          
          if (numberMatches.length > 0) {
            // 질문 매핑 (번호 -> 질문)
            const questions = {
              '1': '블루스를 알게 된 경로',
              '2': '캐릭터명',
              '3': '성별과 나이대',
              '4': '플레이 기간',
              '5': '누렙과 주아르카나',
              '6': '블로니 추억담 3권 클리어 여부',
              '7': '메인스트림 진행상황',
              '8': '주로 하는 컨텐츠',
              '9': '하고 싶은 컨텐츠',
              '10': '주 접속/활동 시간',
              '11': '기대하는 길드활동'
            };
            
            for (const match of numberMatches) {
              const num = match[1];
              const answer = match[2].trim();
              
              if (questions[num]) {
                result[questions[num]] = answer;
              } else {
                result[`문항 ${num}`] = answer;
              }
            }
            
            return result;
          }
          
          // 키워드 패턴으로 항목 구분 (예: 질문: 답변)
          const keywordPattern = /(.*?)[:：]\s*(.*?)(?=(?:\n.*?[:：])|$)/gs;
          const keywordMatches = [...text.matchAll(keywordPattern)];
          
          if (keywordMatches.length > 0) {
            for (const match of keywordMatches) {
              const question = match[1].trim();
              const answer = match[2].trim();
              
              if (question && answer) {
                result[question] = answer;
              }
            }
            
            return result;
          }
          
          // 파싱 실패 시 빈 객체 반환
          return {};
        } catch (error) {
          logger.error(this.name, `가입 신청서 파싱 중 오류 발생: ${error.message}`);
          return {};
        }
      }
      
      /**
       * 모듈 이벤트 리스너 등록
       */
      registerEvents() {
        // 메시지 생성 이벤트 리스너 (가입 신청서 텍스트 감지용)
        this.client.on(Events.MessageCreate, async (message) => {
          await this.detectAndProcessApplication(message);
        });
        
        // 버튼 클릭 이벤트 리스너
        this.client.on(Events.InteractionCreate, async (interaction) => {
          if (!interaction.isButton()) return;
          
          // 추가 버튼 처리
          if (interaction.customId === 'application_form_extended') {
            await this.handleExtendedApplicationForm(interaction);
          } else if (interaction.customId === 'application_form_blog') {
            await this.handleApplicationFormBlog(interaction);
          }
        });
        
        // 모달 제출 이벤트 리스너
        this.client.on(Events.InteractionCreate, async (interaction) => {
          if (!interaction.isModalSubmit()) return;
          
          // 확장 가입 신청서 모달 제출 처리
          if (interaction.customId === 'application_extended_p1') {
            await this.handleExtendedApplicationPart1(interaction);
          } else if (interaction.customId === 'application_extended_p2') {
            await this.handleExtendedApplicationPart2(interaction);
          } else if (interaction.customId === 'application_extended_p3') {
            await this.handleExtendedApplicationPart3(interaction);
          }
        });
        
        logger.success(this.name, '티켓 핸들러 모듈 이벤트 리스너가 등록되었습니다.');
      }
      
      /**
       * 모듈을 시작합니다.
       */
      start() {
        if (this.enabled) {
          this.registerEvents();
          logger.success(this.name, '티켓 핸들러 모듈이 활성화되었습니다.');
        } else {
          logger.warn(this.name, '티켓 핸들러 모듈이 비활성화되어 있습니다.');
        }
        return this;
      }
    }
    
    module.exports = (client) => new TicketHandlerModule(client);