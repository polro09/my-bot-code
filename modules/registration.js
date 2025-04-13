// modules/registration.js
const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    Events,
    ChannelType
  } = require('discord.js');
  const logger = require('../logger');
  const config = require('../config/bot-config');
  const commandManager = require('../commands');
  
  /**
   * 가입 신청서 모듈 클래스
   */
  class RegistrationModule {
    constructor(client) {
      this.client = client;
      this.name = 'registration';
      this.description = '가입 신청서 처리 모듈';
      this.enabled = config.get(`modules.${this.name}.enabled`, true);
      this.configurable = true;
      
      // 신청서 처리를 위한 메모리 캐시
      this.pendingForms = new Map();
      
      // 명령어 등록
      this.registerCommands();
      
      logger.module(this.name, '가입 신청서 모듈이 초기화되었습니다.');
    }
  
    /**
     * 모듈 활성화 여부 설정
     * @param {boolean} enabled 활성화 여부
     */
    setEnabled(enabled) {
      this.enabled = enabled;
      logger.module(this.name, `모듈이 ${enabled ? '활성화' : '비활성화'}되었습니다.`);
    }
  
    /**
     * 슬래시 커맨드 등록
     */
    registerCommands() {
      const registrationCommand = new SlashCommandBuilder()
        .setName('가입신청서')
        .setDescription('가입 신청서 명령어')
        .addSubcommand(subcommand =>
          subcommand
            .setName('설정')
            .setDescription('가입 신청서 채널을 설정합니다.')
            .addChannelOption(option => 
              option.setName('채널')
                .setDescription('가입신청서 결과가 전송될 채널')
                .setRequired(true))
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('생성')
            .setDescription('현재 채널에 가입 신청서 양식을 생성합니다.')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .toJSON();
      
      // 명령어 매니저에 등록
      commandManager.registerModuleCommands(this.name, [registrationCommand]);
    }
  
    /**
     * 모듈 시작
     */
    async start() {
      if (this.enabled) {
        logger.success(this.name, '가입 신청서 모듈이 활성화되었습니다.');
      } else {
        logger.warn(this.name, '가입 신청서 모듈이 비활성화되어 있습니다.');
      }
      return this;
    }
  
    /**
     * 명령어 핸들링
     * @param {Interaction} interaction 명령어 인터렉션
     * @returns {boolean} 처리 여부
     */
    async handleCommands(interaction) {
      if (!interaction.isCommand()) return false;
  
      const { commandName } = interaction;
      
      if (commandName !== '가입신청서') return false;
      
      if (!this.enabled) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#F04747')
              .setTitle('❌ 모듈 비활성화')
              .setDescription('가입 신청서 모듈이 비활성화되어 있습니다.')
              .setTimestamp()
          ],
          ephemeral: true
        });
        return true;
      }
  
      const subcommand = interaction.options.getSubcommand();
      
      if (subcommand === '설정') {
        await this.handleSetupCommand(interaction);
      } else if (subcommand === '생성') {
        await this.handleCreateFormCommand(interaction);
      }
      
      return true;
    }
  
    /**
     * 버튼 인터랙션 핸들링
     * @param {Interaction} interaction 버튼 인터렉션
     * @returns {boolean} 처리 여부
     */
    async handleButtons(interaction) {
      if (!interaction.isButton() || !this.enabled) return false;
      
      const { customId } = interaction;
      
      if (customId === 'registration_form1') {
        await this.handleForm1Button(interaction);
        return true;
      } else if (customId === 'registration_form2') {
        await this.handleForm2Button(interaction);
        return true;
      } else if (customId.startsWith('registration_approve_')) {
        await this.handleApproveButton(interaction);
        return true;
      } else if (customId.startsWith('registration_reject_')) {
        await this.handleRejectButton(interaction);
        return true;
      }
      
      return false;
    }
  
    /**
     * 모달 제출 핸들링
     * @param {Interaction} interaction 모달 인터렉션
     * @returns {boolean} 처리 여부
     */
    async handleModals(interaction) {
      if (!interaction.isModalSubmit() || !this.enabled) return false;
      
      const { customId } = interaction;
      
      if (customId === 'registration_form1_modal') {
        await this.handleForm1Modal(interaction);
        return true;
      } else if (customId === 'registration_form2_modal') {
        await this.handleForm2Modal(interaction);
        return true;
      } else if (customId.startsWith('registration_reject_reason_')) {
        await this.handleRejectReasonModal(interaction);
        return true;
      }
      
      return false;
    }
  
    /**
     * 가입 신청서 설정 명령어 처리
     * @param {Interaction} interaction 명령어 인터렉션
     */
    async handleSetupCommand(interaction) {
      try {
        const channel = interaction.options.getChannel('채널');
        
        // 채널 권한 확인
        if (!channel.viewable || !channel.permissionsFor(interaction.guild.members.me).has('SendMessages')) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor('#F04747')
                .setTitle('❌ 권한 오류')
                .setDescription('선택한 채널에 메시지를 보낼 권한이 없습니다.')
                .setTimestamp()
            ],
            ephemeral: true
          });
        }
        
        // 설정 업데이트
        config.updateModuleConfig(this.name, { channelId: channel.id });
        config.saveConfig();
        
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#43B581')
              .setAuthor({ name: 'aimbot.ad', iconURL: 'https://imgur.com/Sd8qK9c.gif' })
              .setTitle('✅ 가입 신청서 채널 설정 완료')
              .setDescription(`가입 신청서 결과가 <#${channel.id}> 채널로 전송됩니다.`)
              .setTimestamp()
              .setFooter({ text: '🎷Blues', iconURL: interaction.guild.iconURL() })
          ]
        });
        
        logger.success(this.name, `가입 신청서 채널이 #${channel.name} (${channel.id})로 설정되었습니다.`);
      } catch (error) {
        logger.error(this.name, `가입 신청서 채널 설정 오류: ${error.message}`);
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#F04747')
              .setTitle('❌ 오류 발생')
              .setDescription('가입 신청서 채널 설정 중 오류가 발생했습니다.')
              .setTimestamp()
          ],
          ephemeral: true
        });
      }
    }
  
    /**
     * 가입 신청서 생성 명령어 처리
     * @param {Interaction} interaction 명령어 인터렉션
     */
    async handleCreateFormCommand(interaction) {
      try {
        const channelId = config.get('modules.registration.channelId');
        
        if (!channelId) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor('#F04747')
                .setTitle('❌ 설정 필요')
                .setDescription('가입 신청서 채널이 설정되지 않았습니다. `/가입신청서 설정` 명령어로 먼저 채널을 설정해주세요.')
                .setTimestamp()
            ],
            ephemeral: true
          });
        }
        
        const formEmbed = new EmbedBuilder()
          .setColor('#5865F2')
          .setAuthor({ name: 'aimbot.ad', iconURL: 'https://imgur.com/Sd8qK9c.gif' })
          .setTitle('🖊️ 가입 신청서')
          .setDescription('아래 버튼을 클릭하여 가입 신청서를 작성해주세요.')
          .addFields(
            { name: '가입 신청서 1 (기본 정보)', value: '기본 정보를 작성합니다. (닉네임, 나이, 성별 등)', inline: false },
            { name: '가입 신청서 2 (상세 정보)', value: '상세 정보를 작성합니다. (지원 동기, 플레이 가능 시간 등)', inline: false }
          )
          .setTimestamp()
          .setFooter({ text: '🎷Blues', iconURL: interaction.guild.iconURL() });
        
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('registration_form1')
              .setLabel('가입 신청서 1 (기본 정보)')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('📝'),
            new ButtonBuilder()
              .setCustomId('registration_form2')
              .setLabel('가입 신청서 2 (상세 정보)')
              .setStyle(ButtonStyle.Success)
              .setEmoji('📋')
          );
        
        await interaction.channel.send({
          embeds: [formEmbed],
          components: [row]
        });
        
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#43B581')
              .setTitle('✅ 가입 신청서 생성 완료')
              .setDescription('가입 신청서가 현재 채널에 생성되었습니다.')
              .setTimestamp()
          ],
          ephemeral: true
        });
        
        logger.success(this.name, `${interaction.user.tag}님이 가입 신청서를 생성했습니다.`);
      } catch (error) {
        logger.error(this.name, `가입 신청서 생성 오류: ${error.message}`);
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#F04747')
              .setTitle('❌ 오류 발생')
              .setDescription('가입 신청서 생성 중 오류가 발생했습니다.')
              .setTimestamp()
          ],
          ephemeral: true
        });
      }
    }
  
    /**
     * 가입 신청서 1 버튼 클릭 처리
     * @param {Interaction} interaction 버튼 인터렉션
     */
    async handleForm1Button(interaction) {
      try {
        const formFields = config.get('modules.registration.form1Fields', [
          '닉네임', '나이', '성별', '게임 경력'
        ]);
        
        const modal = new ModalBuilder()
          .setCustomId('registration_form1_modal')
          .setTitle('가입 신청서 1 (기본 정보)');
        
        // 폼 필드 추가
        const components = [];
        
        formFields.forEach((field, index) => {
          if (!field) return;
          
          const textInput = new TextInputBuilder()
            .setCustomId(`field${index + 1}`)
            .setLabel(field)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100);
          
          components.push(new ActionRowBuilder().addComponents(textInput));
        });
        
        modal.addComponents(...components);
        
        await interaction.showModal(modal);
      } catch (error) {
        logger.error(this.name, `가입 신청서 1 모달 표시 오류: ${error.message}`);
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#F04747')
              .setTitle('❌ 오류 발생')
              .setDescription('가입 신청서 모달을 표시하는 중 오류가 발생했습니다.')
              .setTimestamp()
          ],
          ephemeral: true
        });
      }
    }
  
    /**
   * 가입 신청서 2 버튼 클릭 처리
   * @param {Interaction} interaction 버튼 인터렉션
   */
  async handleForm2Button(interaction) {
    try {
      const formFields = config.get('modules.registration.form2Fields', [
        '지원 동기', '플레이 가능 시간', '소속 길드', '기타 사항'
      ]);
      
      const modal = new ModalBuilder()
        .setCustomId('registration_form2_modal')
        .setTitle('가입 신청서 2 (상세 정보)');
      
      // 폼 필드 추가
      const components = [];
      
      formFields.forEach((field, index) => {
        if (!field) return;
        
        const textInput = new TextInputBuilder()
          .setCustomId(`field${index + 1}`)
          .setLabel(field)
          .setStyle(index === 0 || index === 3 ? TextInputStyle.Paragraph : TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(index === 0 || index === 3 ? 1000 : 100);
        
        components.push(new ActionRowBuilder().addComponents(textInput));
      });
      
      modal.addComponents(...components);
      
      await interaction.showModal(modal);
    } catch (error) {
      logger.error(this.name, `가입 신청서 2 모달 표시 오류: ${error.message}`);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#F04747')
            .setTitle('❌ 오류 발생')
            .setDescription('가입 신청서 모달을 표시하는 중 오류가 발생했습니다.')
            .setTimestamp()
        ],
        ephemeral: true
      });
    }
  }

  /**
   * 가입 신청서 1 모달 제출 처리
   * @param {Interaction} interaction 모달 인터렉션
   */
  async handleForm1Modal(interaction) {
    try {
      const formFields = config.get('modules.registration.form1Fields', [
        '닉네임', '나이', '성별', '게임 경력'
      ]);
      
      // 필드값 가져오기
      const values = {};
      formFields.forEach((field, index) => {
        if (!field) return;
        values[field] = interaction.fields.getTextInputValue(`field${index + 1}`);
      });
      
      // 가입 신청서 결과 채널 ID 가져오기
      const channelId = config.get('modules.registration.channelId');
      if (!channelId) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#F04747')
              .setTitle('❌ 설정 오류')
              .setDescription('가입 신청서 채널이 설정되지 않았습니다. 관리자에게 문의하세요.')
              .setTimestamp()
          ],
          ephemeral: true
        });
      }
      
      // 가입 신청서 채널 가져오기
      const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#F04747')
              .setTitle('❌ 채널 오류')
              .setDescription('가입 신청서 채널을 찾을 수 없습니다. 관리자에게 문의하세요.')
              .setTimestamp()
          ],
          ephemeral: true
        });
      }
      
      // 결과 임베드 생성
      const resultEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setAuthor({ name: 'aimbot.ad', iconURL: 'https://imgur.com/Sd8qK9c.gif' })
        .setTitle('📝 가입 신청서 1 (기본 정보)')
        .setDescription(`${interaction.user.tag} (${interaction.user.id})님이 작성한 가입 신청서입니다.`)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: '🎷Blues', iconURL: interaction.guild.iconURL() });
      
      // 필드 정보 추가
      Object.entries(values).forEach(([field, value]) => {
        resultEmbed.addFields({ name: field, value: value || '작성되지 않음', inline: true });
      });
      
      // 채널에 결과 전송
      await channel.send({ embeds: [resultEmbed] });
      
      // 티켓 생성
      await this.createTicketChannel(interaction, '가입 신청서 1', values);
      
      // 완료 메시지
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#43B581')
            .setTitle('✅ 가입 신청서 제출 완료')
            .setDescription('가입 신청서 1(기본 정보)가 성공적으로 제출되었습니다.')
            .setTimestamp()
        ],
        ephemeral: true
      });
      
      logger.success(this.name, `${interaction.user.tag}님이 가입 신청서 1을 제출했습니다.`);
    } catch (error) {
      logger.error(this.name, `가입 신청서 1 처리 오류: ${error.message}`);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#F04747')
            .setTitle('❌ 오류 발생')
            .setDescription('가입 신청서를 처리하는 중 오류가 발생했습니다.')
            .setTimestamp()
        ],
        ephemeral: true
      });
    }
  }

  /**
   * 가입 신청서 2 모달 제출 처리
   * @param {Interaction} interaction 모달 인터렉션
   */
  async handleForm2Modal(interaction) {
    try {
      const formFields = config.get('modules.registration.form2Fields', [
        '지원 동기', '플레이 가능 시간', '소속 길드', '기타 사항'
      ]);
      
      // 필드값 가져오기
      const values = {};
      formFields.forEach((field, index) => {
        if (!field) return;
        values[field] = interaction.fields.getTextInputValue(`field${index + 1}`);
      });
      
      // 가입 신청서 결과 채널 ID 가져오기
      const channelId = config.get('modules.registration.channelId');
      if (!channelId) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#F04747')
              .setTitle('❌ 설정 오류')
              .setDescription('가입 신청서 채널이 설정되지 않았습니다. 관리자에게 문의하세요.')
              .setTimestamp()
          ],
          ephemeral: true
        });
      }
      
      // 가입 신청서 채널 가져오기
      const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#F04747')
              .setTitle('❌ 채널 오류')
              .setDescription('가입 신청서 채널을 찾을 수 없습니다. 관리자에게 문의하세요.')
              .setTimestamp()
          ],
          ephemeral: true
        });
      }
      
      // 결과 임베드 생성
      const resultEmbed = new EmbedBuilder()
        .setColor('#43B581')
        .setAuthor({ name: 'aimbot.ad', iconURL: 'https://imgur.com/Sd8qK9c.gif' })
        .setTitle('📋 가입 신청서 2 (상세 정보)')
        .setDescription(`${interaction.user.tag} (${interaction.user.id})님이 작성한 가입 신청서입니다.`)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: '🎷Blues', iconURL: interaction.guild.iconURL() });
      
      // 필드 정보 추가
      Object.entries(values).forEach(([field, value]) => {
        resultEmbed.addFields({ name: field, value: value || '작성되지 않음', inline: false });
      });
      
      // 승인/거부 버튼 추가
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`registration_approve_${interaction.user.id}`)
            .setLabel('승인')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
          new ButtonBuilder()
            .setCustomId(`registration_reject_${interaction.user.id}`)
            .setLabel('거부')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
        );
      
      // 채널에 결과 전송
      await channel.send({ 
        embeds: [resultEmbed],
        components: [row]
      });
      
      // 티켓 생성
      await this.createTicketChannel(interaction, '가입 신청서 2', values);
      
      // 완료 메시지
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#43B581')
            .setTitle('✅ 가입 신청서 제출 완료')
            .setDescription('가입 신청서 2(상세 정보)가 성공적으로 제출되었습니다. 관리자의 승인을 기다려주세요.')
            .setTimestamp()
        ],
        ephemeral: true
      });
      
      logger.success(this.name, `${interaction.user.tag}님이 가입 신청서 2를 제출했습니다.`);
    } catch (error) {
      logger.error(this.name, `가입 신청서 2 처리 오류: ${error.message}`);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#F04747')
            .setTitle('❌ 오류 발생')
            .setDescription('가입 신청서를 처리하는 중 오류가 발생했습니다.')
            .setTimestamp()
        ],
        ephemeral: true
      });
    }
  }

  /**
   * 가입 신청서 승인 버튼 처리
   * @param {Interaction} interaction 버튼 인터렉션
   */
  async handleApproveButton(interaction) {
    try {
      // 승인 권한 체크
      const approvalRoleId = config.get('modules.registration.approvalRoleId');
      if (approvalRoleId && !interaction.member.roles.cache.has(approvalRoleId)) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#F04747')
              .setTitle('❌ 권한 부족')
              .setDescription('가입 신청서를 승인할 권한이 없습니다.')
              .setTimestamp()
          ],
          ephemeral: true
        });
      }
      
      // 유저 ID 가져오기
      const userId = interaction.customId.split('_')[2];
      if (!userId) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#F04747')
              .setTitle('❌ 오류 발생')
              .setDescription('유저 ID를 찾을 수 없습니다.')
              .setTimestamp()
          ],
          ephemeral: true
        });
      }
      
      // 원본 메시지 업데이트
      const message = interaction.message;
      const embed = message.embeds[0];
      
      // 임베드 업데이트
      const updatedEmbed = EmbedBuilder.from(embed)
        .setColor('#43B581')
        .addFields({ 
          name: '📢 승인 정보', 
          value: `승인자: ${interaction.user.tag}\n승인 시간: ${new Date().toLocaleString('ko-KR')}`,
          inline: false 
        });
      
      // 버튼 비활성화
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`registration_approve_${userId}`)
            .setLabel('승인됨')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅')
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId(`registration_reject_${userId}`)
            .setLabel('거부')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
            .setDisabled(true)
        );
      
      // 메시지 업데이트
      await message.edit({ 
        embeds: [updatedEmbed],
        components: [row]
      });
      
      // 멤버 찾기
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (member) {
        // DM 메시지 전송
        try {
          await member.send({
            embeds: [
              new EmbedBuilder()
                .setColor('#43B581')
                .setAuthor({ name: 'aimbot.ad', iconURL: 'https://imgur.com/Sd8qK9c.gif' })
                .setTitle('✅ 가입 신청서 승인')
                .setDescription(`${member.user.tag}님의 가입 신청서가 승인되었습니다!`)
                .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                .addFields(
                  { name: '서버', value: interaction.guild.name, inline: true },
                  { name: '승인자', value: interaction.user.tag, inline: true },
                  { name: '승인 시간', value: new Date().toLocaleString('ko-KR'), inline: true }
                )
                .setTimestamp()
                .setFooter({ text: '🎷Blues', iconURL: interaction.guild.iconURL() })
            ]
          });
        } catch (dmError) {
          logger.warn(this.name, `${member.user.tag}님에게 DM을 보낼 수 없습니다: ${dmError.message}`);
        }
      }
      
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#43B581')
            .setTitle('✅ 가입 신청서 승인 완료')
            .setDescription(`<@${userId}>님의 가입 신청서가 승인되었습니다.`)
            .setTimestamp()
        ],
        ephemeral: true
      });
      
      logger.success(this.name, `${interaction.user.tag}님이 ${userId} 유저의 가입 신청서를 승인했습니다.`);
    } catch (error) {
      logger.error(this.name, `가입 신청서 승인 오류: ${error.message}`);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#F04747')
            .setTitle('❌ 오류 발생')
            .setDescription('가입 신청서 승인 중 오류가 발생했습니다.')
            .setTimestamp()
        ],
        ephemeral: true
      });
    }
  }

  /**
   * 가입 신청서 거부 버튼 처리
   * @param {Interaction} interaction 버튼 인터렉션
   */
  async handleRejectButton(interaction) {
    try {
      // 승인 권한 체크
      const approvalRoleId = config.get('modules.registration.approvalRoleId');
      if (approvalRoleId && !interaction.member.roles.cache.has(approvalRoleId)) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#F04747')
              .setTitle('❌ 권한 부족')
              .setDescription('가입 신청서를 거부할 권한이 없습니다.')
              .setTimestamp()
          ],
          ephemeral: true
        });
      }
      
      // 유저 ID 가져오기
      const userId = interaction.customId.split('_')[2];
      if (!userId) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#F04747')
              .setTitle('❌ 오류 발생')
              .setDescription('유저 ID를 찾을 수 없습니다.')
              .setTimestamp()
          ],
          ephemeral: true
        });
      }
      
      // 거부 사유 모달
      const modal = new ModalBuilder()
        .setCustomId(`registration_reject_reason_${userId}`)
        .setTitle('가입 신청서 거부 사유');
        
      const reasonInput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('거부 사유')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('거부 사유를 입력해주세요.')
        .setRequired(true)
        .setMaxLength(1000);
      
      const actionRow = new ActionRowBuilder().addComponents(reasonInput);
      
      modal.addComponents(actionRow);
      
      await interaction.showModal(modal);
    } catch (error) {
      logger.error(this.name, `가입 신청서 거부 모달 표시 오류: ${error.message}`);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#F04747')
            .setTitle('❌ 오류 발생')
            .setDescription('가입 신청서 거부 모달을 표시하는 중 오류가 발생했습니다.')
            .setTimestamp()
        ],
        ephemeral: true
      });
    }
  }

  /**
   * 가입 신청서 거부 사유 모달 처리
   * @param {Interaction} interaction 모달 인터렉션
   */
  async handleRejectReasonModal(interaction) {
    try {
      // 유저 ID 가져오기
      const userId = interaction.customId.split('_')[3];
      if (!userId) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#F04747')
              .setTitle('❌ 오류 발생')
              .setDescription('유저 ID를 찾을 수 없습니다.')
              .setTimestamp()
          ],
          ephemeral: true
        });
      }
      
      // 거부 사유 가져오기
      const reason = interaction.fields.getTextInputValue('reason');
      
      // 원본 메시지 업데이트
      const message = await interaction.message;
      const embed = message.embeds[0];
      
      // 임베드 업데이트
      const updatedEmbed = EmbedBuilder.from(embed)
        .setColor('#F04747')
        .addFields(
          { 
            name: '⛔ 거부 정보', 
            value: `거부자: ${interaction.user.tag}\n거부 시간: ${new Date().toLocaleString('ko-KR')}`,
            inline: false 
          },
          { 
            name: '📝 거부 사유', 
            value: reason || '사유 없음',
            inline: false 
          }
        );
      
      // 버튼 비활성화
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`registration_approve_${userId}`)
            .setLabel('승인')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅')
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId(`registration_reject_${userId}`)
            .setLabel('거부됨')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
            .setDisabled(true)
        );
      
      // 메시지 업데이트
      await message.edit({ 
        embeds: [updatedEmbed],
        components: [row]
      });
      
      // 멤버 찾기
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (member) {
        // DM 메시지 전송
        try {
          await member.send({
            embeds: [
              new EmbedBuilder()
                .setColor('#F04747')
                .setAuthor({ name: 'aimbot.ad', iconURL: 'https://imgur.com/Sd8qK9c.gif' })
                .setTitle('⛔ 가입 신청서 거부')
                .setDescription(`${member.user.tag}님의 가입 신청서가 거부되었습니다.`)
                .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                .addFields(
                  { name: '서버', value: interaction.guild.name, inline: true },
                  { name: '거부자', value: interaction.user.tag, inline: true },
                  { name: '거부 시간', value: new Date().toLocaleString('ko-KR'), inline: true },
                  { name: '거부 사유', value: reason || '사유 없음', inline: false }
                )
                .setTimestamp()
                .setFooter({ text: '🎷Blues', iconURL: interaction.guild.iconURL() })
            ]
          });
        } catch (dmError) {
          logger.warn(this.name, `${member.user.tag}님에게 DM을 보낼 수 없습니다: ${dmError.message}`);
        }
      }
      
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#F04747')
            .setTitle('⛔ 가입 신청서 거부 완료')
            .setDescription(`<@${userId}>님의 가입 신청서가 거부되었습니다.`)
            .addFields(
              { name: '거부 사유', value: reason || '사유 없음', inline: false }
            )
            .setTimestamp()
        ],
        ephemeral: true
      });
      
      logger.success(this.name, `${interaction.user.tag}님이 ${userId} 유저의 가입 신청서를 거부했습니다. 사유: ${reason || '사유 없음'}`);
    } catch (error) {
      logger.error(this.name, `가입 신청서 거부 처리 오류: ${error.message}`);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#F04747')
            .setTitle('❌ 오류 발생')
            .setDescription('가입 신청서 거부 처리 중 오류가 발생했습니다.')
            .setTimestamp()
        ],
        ephemeral: true
      });
    }
  }

  /**
   * 티켓 채널 생성
   * @param {Interaction} interaction 인터렉션
   * @param {string} title 티켓 제목
   * @param {Object} data 신청서 데이터
   */
  async createTicketChannel(interaction, title, data) {
    try {
      // 티켓 카테고리 ID 가져오기
      const categoryId = config.get('modules.registration.ticketCategoryId');
      if (!categoryId) {
        logger.warn(this.name, '티켓 카테고리가 설정되지 않았습니다.');
        return;
      }
      
      // 카테고리 가져오기
      const category = await interaction.guild.channels.fetch(categoryId).catch(() => null);
      if (!category) {
        logger.warn(this.name, '티켓 카테고리를 찾을 수 없습니다.');
        return;
      }
      
      // 티켓 채널 이름 생성
      const channelName = `신청서-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;
      
      // 채널 생성
      const channel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: ['ViewChannel']
          },
          {
            id: interaction.user.id,
            allow: ['ViewChannel', 'ReadMessageHistory'],
            deny: ['SendMessages']
          },
          {
            id: interaction.client.user.id,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
          }
        ]
      });
      
      // 승인 역할 권한 설정
      const approvalRoleId = config.get('modules.registration.approvalRoleId');
      if (approvalRoleId) {
        await channel.permissionOverwrites.create(approvalRoleId, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        });
      }
      
      // 임베드 생성
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setAuthor({ name: 'aimbot.ad', iconURL: 'https://imgur.com/Sd8qK9c.gif' })
        .setTitle(`📝 ${title}`)
        .setDescription(`${interaction.user.tag} (${interaction.user.id})님이 작성한 가입 신청서입니다.`)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: '🎷Blues', iconURL: interaction.guild.iconURL() });
      
      // 필드 정보 추가
      Object.entries(data).forEach(([field, value]) => {
        embed.addFields({ name: field, value: value || '작성되지 않음', inline: title === '가입 신청서 1' });
      });
      
      // 메시지 전송
      await channel.send({
        content: `<@${interaction.user.id}> ${approvalRoleId ? `<@&${approvalRoleId}>` : ''}`,
        embeds: [embed]
      });
      
      logger.success(this.name, `${interaction.user.tag}님의 티켓 채널이 생성되었습니다: #${channelName}`);
    } catch (error) {
      logger.error(this.name, `티켓 채널 생성 오류: ${error.message}`);
    }
  }
}

module.exports = (client) => new RegistrationModule(client);