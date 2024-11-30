import discord
from discord.ext import commands
from discord import ui
import json
import os
from datetime import datetime, time, timedelta
import logging
from typing import Optional, Set, Dict, Any

logger = logging.getLogger('combat_system')

class UserCombatData:
    def __init__(self):
        self.data_folder = './db/users'
        os.makedirs(self.data_folder, exist_ok=True)

    def get_file_path(self, user_id: int) -> str:
        return os.path.join(self.data_folder, f'{user_id}_combat.json')

    def save_combat_result(self, user_id: int, combat_data: dict):
        file_path = self.get_file_path(user_id)
        try:
            if os.path.exists(file_path):
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            else:
                data = {
                    'user_id': user_id,
                    'total_matches': 0,
                    'total_kills': 0,
                    'wins': 0,
                    'losses': 0,
                    'matches': []
                }
            
            # 새로운 전투 결과 추가
            data['matches'].append({
                'timestamp': datetime.now().isoformat(),
                'unit_type': combat_data['unit_type'],
                'kills': int(combat_data['kills']),
                'result': combat_data['result']
            })
            
            # 통계 업데이트
            data['total_matches'] += 1
            data['total_kills'] += int(combat_data['kills'])
            if combat_data['result'] == '승':
                data['wins'] += 1
            elif combat_data['result'] == '패':
                data['losses'] += 1
            
            # 주력 병종 계산
            unit_counts = {}
            for match in data['matches']:
                unit_counts[match['unit_type']] = unit_counts.get(match['unit_type'], 0) + 1
            data['main_unit'] = max(unit_counts.items(), key=lambda x: x[1])[0]
            
            # 파일 저장
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                
            return True
        except Exception as e:
            logger.error(f"전투 데이터 저장 중 오류 발생: {e}")
            return False

    def get_user_stats(self, user_id: int) -> dict:
        file_path = self.get_file_path(user_id)
        try:
            if not os.path.exists(file_path):
                return {
                    'win_rate': 0,
                    'avg_kills': 0,
                    'main_unit': None,
                    'total_matches': 0
                }
                
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            total_matches = data['total_matches']
            if total_matches == 0:
                return {
                    'win_rate': 0,
                    'avg_kills': 0,
                    'main_unit': None,
                    'total_matches': 0
                }
                
            win_rate = (data['wins'] / total_matches) * 100
            avg_kills = data['total_kills'] / total_matches
            
            return {
                'win_rate': round(win_rate, 1),
                'avg_kills': round(avg_kills, 1),
                'main_unit': data.get('main_unit'),
                'total_matches': total_matches
            }
        except Exception as e:
            logger.error(f"유저 통계 조회 중 오류 발생: {e}")
            return None
        
class CombatSystem(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.participants: Dict[int, Dict[str, Any]] = {}
        self.waiting_list: Set[int] = set()
        self.absent_list: Set[int] = set()
        self.team1: Set[int] = set()
        self.team2: Set[int] = set()
        self.start_time = None
        self.user_data = UserCombatData()
        
        if not os.path.exists('./db'):
            os.makedirs('./db')

    def get_combat_config(self) -> dict:
        return self.bot.config.get('combat_system', {})

    async def log_to_channel(self, content: str, is_announcement: bool = False, log_type: str = "INFO"):
        try:
            config = self.get_combat_config()
            channels = config.get('channels', {})
            
            channel_id = channels.get('combat_announcements' if is_announcement else 'combat_logs')
            if not channel_id:
                return
                
            channel = self.bot.get_channel(channel_id)
            if not channel:
                return

            embed = discord.Embed(
                description=content,
                color=discord.Color.blue() if is_announcement else discord.Color.green(),
                timestamp=datetime.now()
            )
            
            if is_announcement:
                embed.title = "🔔 모의전 공지"
                embed.set_thumbnail(url="https://i.imgur.com/ftS8Tc1.jpeg")
                await channel.send("@here", embed=embed)
            else:
                if log_type == "JOIN":
                    embed.color = discord.Color.green()
                    embed.title = "📥 참가 알림"
                elif log_type == "WAIT":
                    embed.color = discord.Color.yellow()
                    embed.title = "⏳ 대기 알림"
                elif log_type == "ABSENT":
                    embed.color = discord.Color.red()
                    embed.title = "❌ 불참 알림"
                elif log_type == "INFO":
                    embed.color = discord.Color.blue()
                    embed.title = "ℹ️ 정보"
                elif log_type == "COMBAT":
                    embed.color = discord.Color.purple()
                    embed.title = "⚔️ 전투 결과"
                elif log_type == "TEAM":
                    embed.color = discord.Color.gold()
                    embed.title = "👥 팀 구성"
                
                await channel.send(embed=embed)
                
        except Exception as e:
            logger.error(f"로그 기록 중 오류 발생: {e}")

    def has_combat_role(self, member: discord.Member) -> bool:
        try:
            config = self.get_combat_config()
            roles = config.get('roles', {})
            
            user_role_ids = {role.id for role in member.roles}
            allowed_roles = {
                roles.get('commander'),
                roles.get('officer'),
                roles.get('soldier')
            }
            allowed_roles.discard(None)
            
            return bool(user_role_ids & allowed_roles)
        except Exception as e:
            logger.error(f"권한 확인 중 오류 발생: {e}")
            return False

    def has_commander_role(self, member: discord.Member) -> bool:
        try:
            config = self.get_combat_config()
            commander_role = config.get('roles', {}).get('commander')
            if not commander_role:
                return False
            return commander_role in {role.id for role in member.roles}
        except Exception as e:
            logger.error(f"지휘관 권한 확인 중 오류 발생: {e}")
            return False

    def get_unit_display(self, unit_type: str) -> str:
        unit_emojis = {
            '궁병': '🏹궁병',
            '모루': '🛡️모루',
            '망치': '⚔️망치',
            '기병': '🐎기병',
            '궁기병': '🏇궁기병'
        }
        return unit_emojis.get(unit_type, unit_type)

    def create_combat_embed(self) -> discord.Embed:
        embed = discord.Embed(
            title="모의전 참가 신청",
            color=discord.Color.blue(),
            timestamp=datetime.now()
        )
        
        # 썸네일과 이미지 설정
        embed.set_thumbnail(url="https://i.imgur.com/ftS8Tc1.jpeg")
        embed.set_image(url="https://i.imgur.com/pLwAVhO.jpeg")
        
        # 시작 시간 표시
        if self.start_time:
            embed.add_field(
                name="⏰ 시작 시간",
                value=f"<t:{int(self.start_time.timestamp())}:F>",
                inline=False
            )

    # create_combat_embed 메서드 계속
        # 참여자 목록
        participant_text = ""
        for user_id, data in self.participants.items():
            user_mention = f"<@{user_id}>"
            unit_type = self.get_unit_display(data.get('unit_type', '알 수 없음'))
            
            stats = self.user_data.get_user_stats(user_id)
            if stats:
                participant_text += (
                    f"{user_mention} - {unit_type}\n"
                    f"└ 승률: {stats['win_rate']}% | "
                    f"평균킬: {stats['avg_kills']} | "
                    f"주력: {self.get_unit_display(stats['main_unit']) if stats['main_unit'] else '없음'}\n"
                )
            else:
                participant_text += f"{user_mention} - {unit_type}\n"

        embed.add_field(name="👥 참여자", value=participant_text or "없음", inline=False)
        
        # 대기자와 불참자 목록 (한 줄에 나란히)
        embed.add_field(
            name="⏳ 대기자",
            value="\n".join([f"<@{user_id}>" for user_id in self.waiting_list]) or "없음",
            inline=True
        )
        embed.add_field(
            name="❌ 불참자",
            value="\n".join([f"<@{user_id}>" for user_id in self.absent_list]) or "없음",
            inline=True
        )

        # 빈 필드로 줄바꿈
        embed.add_field(name="\u200b", value="\u200b", inline=False)
        
        # 팀 구성 (한 줄에 나란히)
        team1_text = ""
        for user_id in self.team1:
            user_data = self.participants.get(user_id, {})
            unit_type = self.get_unit_display(user_data.get('unit_type', ''))
            stats = self.user_data.get_user_stats(user_id)
            if stats:
                team1_text += (
                    f"<@{user_id}> {unit_type}\n"
                    f"└ 승률: {stats['win_rate']}% | 평균킬: {stats['avg_kills']}\n"
                )
            else:
                team1_text += f"<@{user_id}> {unit_type}\n"
        
        team2_text = ""
        for user_id in self.team2:
            user_data = self.participants.get(user_id, {})
            unit_type = self.get_unit_display(user_data.get('unit_type', ''))
            stats = self.user_data.get_user_stats(user_id)
            if stats:
                team2_text += (
                    f"<@{user_id}> {unit_type}\n"
                    f"└ 승률: {stats['win_rate']}% | 평균킬: {stats['avg_kills']}\n"
                )
            else:
                team2_text += f"<@{user_id}> {unit_type}\n"

        embed.add_field(name="🔵 1팀", value=team1_text or "없음", inline=True)
        embed.add_field(name="🔴 2팀", value=team2_text or "없음", inline=True)
        
        return embed

    class TimeSetModal(discord.ui.Modal, title='모의전 시간 설정'):
        def __init__(self, cog) -> None:
            super().__init__()
            self.cog = cog
            self.time_input = discord.ui.TextInput(
                label='시작 시간',
                placeholder='예: 20:30 (24시간 형식)',
                required=True
            )
            self.add_item(self.time_input)

        async def on_submit(self, interaction: discord.Interaction):
            try:
                # 시간 형식 파싱 (HH:MM)
                hour, minute = map(int, self.time_input.value.split(':'))
                current_date = datetime.now()
                start_time = datetime.combine(current_date.date(), time(hour, minute))
                
                # 만약 입력한 시간이 현재 시간보다 이전이라면 다음 날로 설정
                if start_time < current_date:
                    start_time = datetime.combine(current_date.date() + timedelta(days=1), time(hour, minute))
                
                self.cog.start_time = start_time
                
                embed = self.cog.create_combat_embed()
                view = self.cog.CombatView(self.cog)
                await interaction.response.send_message(embed=embed, view=view)
                
                await self.cog.log_to_channel(
                    f"{interaction.user.display_name}님이 모의전을 시작했습니다.\n"
                    f"시작 시간: <t:{int(start_time.timestamp())}:F>",
                    is_announcement=True
                )
                
            except ValueError:
                await interaction.response.send_message(
                    "올바른 시간 형식을 입력해주세요. (예: 20:30)",
                    ephemeral=True
                )
            except Exception as e:
                logger.error(f"시간 설정 중 오류 발생: {e}")
                await interaction.response.send_message(
                    "시간 설정 중 오류가 발생했습니다.",
                    ephemeral=True
                )

    class CombatView(discord.ui.View):
        def __init__(self, cog):
            super().__init__(timeout=None)
            self.cog = cog

        @discord.ui.button(label="참여", style=discord.ButtonStyle.success, emoji="✅", custom_id="join")
        async def join_button(self, interaction: discord.Interaction, button: discord.ui.Button):
            await interaction.response.send_message(
                "병종을 선택하세요:",
                view=self.cog.SelectUnitView(self.cog),
                ephemeral=True
            )

        @discord.ui.button(label="대기", style=discord.ButtonStyle.secondary, emoji="⏳", custom_id="wait")
        async def wait_button(self, interaction: discord.Interaction, button: discord.ui.Button):
            user_id = interaction.user.id
            self.cog.waiting_list.add(user_id)
            self.cog.participants.pop(user_id, None)
            self.cog.absent_list.discard(user_id)
            
            await self.cog.log_to_channel(
                f"{interaction.user.display_name}님이 대기자 명단에 추가되었습니다.",
                log_type="WAIT"
            )
            
            await interaction.response.edit_message(
                embed=self.cog.create_combat_embed(),
                view=self
            )

        @discord.ui.button(label="불참", style=discord.ButtonStyle.danger, emoji="❌", custom_id="absent")
        async def absent_button(self, interaction: discord.Interaction, button: discord.ui.Button):
            user_id = interaction.user.id
            self.cog.absent_list.add(user_id)
            self.cog.participants.pop(user_id, None)
            self.cog.waiting_list.discard(user_id)
            
            await self.cog.log_to_channel(
                f"{interaction.user.display_name}님이 불참자 명단에 추가되었습니다.",
                log_type="ABSENT"
            )
            
            await interaction.response.edit_message(
                embed=self.cog.create_combat_embed(),
                view=self
            )

        @discord.ui.button(label="정보", style=discord.ButtonStyle.primary, emoji="💾", custom_id="info")
        async def info_button(self, interaction: discord.Interaction, button: discord.ui.Button):
            if interaction.user.id not in self.cog.participants:
                await interaction.response.send_message(
                    "모의전 참가자만 정보를 입력할 수 있습니다.",
                    ephemeral=True
                )
                return
            await interaction.response.send_modal(self.cog.InfoModal(self.cog))

        @discord.ui.button(label="팀생성", style=discord.ButtonStyle.primary, emoji="👨‍👨‍👦", custom_id="team")
        async def team_button(self, interaction: discord.Interaction, button: discord.ui.Button):
            if not self.cog.has_commander_role(interaction.user):
                await interaction.response.send_message(
                    "팀 생성은 지휘관만 가능합니다.",
                    ephemeral=True
                )
                return

            if not self.cog.participants:
                await interaction.response.send_message(
                    "참가자가 없습니다.",
                    ephemeral=True
                )
                return
                
            view = self.cog.TeamSelectView(self.cog)
            await interaction.response.send_message(
                "팀을 구성할 멤버를 선택하세요:",
                view=view,
                ephemeral=True
            )

    class SelectUnitView(discord.ui.View):
        def __init__(self, cog):
            super().__init__(timeout=180)
            self.cog = cog

            self.unit_select = discord.ui.Select(
    placeholder="병종을 선택하세요",
    min_values=1,
    max_values=1,
    options=[
        discord.SelectOption(
            label="궁병",
            value="궁병",
            description="원거리 공격 유닛",
            emoji="🏹"
        ),
        discord.SelectOption(
            label="모루",
            value="모루",
            description="방어 특화 유닛",
            emoji="🛡️"
        ),
        discord.SelectOption(
            label="망치",
            value="망치",
            description="근접 공격 유닛",
            emoji="⚔️"
        ),
        discord.SelectOption(
            label="기병",
            value="기병",
            description="기동성 특화 유닛",
            emoji="🐎"
        ),
        discord.SelectOption(
            label="궁기병",
            value="궁기병",
            description="원거리 기동 유닛",
            emoji="🏇"
        )
    ]
)
            self.add_item(self.unit_select)

        @discord.ui.select()
        async def select_callback(self, interaction: discord.Interaction, select: discord.ui.Select):
            try:
                selected_unit = select.values[0]
                
                self.cog.participants[interaction.user.id] = {
                    'unit_type': selected_unit,
                    'joined_at': datetime.now().isoformat()
                }
                
                self.cog.absent_list.discard(interaction.user.id)
                self.cog.waiting_list.discard(interaction.user.id)
                
                display_unit = self.cog.get_unit_display(selected_unit)
                await self.cog.log_to_channel(
                    f"{interaction.user.display_name}님이 {display_unit}(으)로 참가했습니다.",
                    log_type="JOIN"
                )
                
                message = interaction.message
                if hasattr(message, 'reference') and message.reference:
                    try:
                        original_message = await interaction.channel.fetch_message(
                            message.reference.message_id
                        )
                        await original_message.edit(
                            embed=self.cog.create_combat_embed(),
                            view=self.cog.CombatView(self.cog)
                        )
                    except:
                        pass

                await interaction.response.edit_message(
                    content=f"{display_unit}을(를) 선택했습니다!",
                    view=None
                )
                
            except Exception as e:
                logger.error(f"병종 선택 중 오류 발생: {e}")
                await interaction.response.send_message(
                    "병종 선택 중 오류가 발생했습니다.",
                    ephemeral=True
                )

        async def on_timeout(self):
            for child in self.children:
                child.disabled = True
            await self.message.edit(view=self)

    class InfoModal(discord.ui.Modal, title='전투 정보 입력'):
        def __init__(self, cog) -> None:
            super().__init__()
            self.cog = cog
            self.unit_type = discord.ui.TextInput(
                label='주력병종',
                placeholder='사용한 병종을 입력하세요',
                required=True,
                max_length=100
            )
            self.kills = discord.ui.TextInput(
                label='킬 수',
                placeholder='숫자만 입력하세요',
                required=True,
                max_length=10
            )
            self.result = discord.ui.TextInput(
                label='결과',
                placeholder='승/패 중 하나를 입력하세요',
                required=True,
                max_length=10
            )
            
            self.add_item(self.unit_type)
            self.add_item(self.kills)
            self.add_item(self.result)

        async def on_submit(self, interaction: discord.Interaction):
            info = {
                'user_id': interaction.user.id,
                'username': interaction.user.name,
                'unit_type': self.unit_type.value,
                'kills': self.kills.value,
                'result': self.result.value,
                'timestamp': datetime.now().isoformat()
            }
            
            try:
                # 전투 데이터 저장
                self.cog.user_data.save_combat_result(interaction.user.id, info)
                
                # 로그 메시지 전송
                result_message = (
                    f"플레이어: {interaction.user.display_name}\n"
                    f"병종: {self.unit_type.value}\n"
                    f"킬: {self.kills.value}\n"
                    f"결과: {self.result.value}"
                )
                await self.cog.log_to_channel(result_message, log_type="COMBAT")
                
                await interaction.response.send_message(
                    "전투 정보가 저장되었습니다.",
                    ephemeral=True
                )
                
            except Exception as e:
                logger.error(f"전투 정보 저장 중 오류 발생: {e}")
                await interaction.response.send_message(
                    "전투 정보 저장에 실패했습니다.",
                    ephemeral=True
                )

    class TeamSelectView(discord.ui.View):
        def __init__(self, cog):
            super().__init__()
            self.cog = cog
            
            options = [
                discord.SelectOption(
                    label=f"{cog.bot.get_user(user_id).display_name}",
                    value=str(user_id),
                    description=f"{data.get('unit_type', '알 수 없음')}",
                    emoji="🔵"
                ) for user_id, data in cog.participants.items()
            ]
            
            self.team1_select = discord.ui.Select(
                placeholder="1팀 선택",
                min_values=1,
                max_values=len(cog.participants),
                options=options
            )
            self.team1_select.callback = self.on_team1_select
            
            self.team2_select = discord.ui.Select(
                placeholder="2팀 선택",
                min_values=1,
                max_values=len(cog.participants),
                options=options
            )
            self.team2_select.callback = self.on_team2_select
            
            self.confirm_button = discord.ui.Button(
                style=discord.ButtonStyle.success,
                label="팀 구성 완료",
                emoji="✅"
            )
            self.confirm_button.callback = self.on_confirm

            self.add_item(self.team1_select)
            self.add_item(self.team2_select)
            self.add_item(self.confirm_button)
            
            self.temp_team1 = set()
            self.temp_team2 = set()

        async def on_team1_select(self, interaction: discord.Interaction):
            self.temp_team1 = {int(id) for id in self.team1_select.values}
            await interaction.response.defer()

        async def on_team2_select(self, interaction: discord.Interaction):
            self.temp_team2 = {int(id) for id in self.team2_select.values}
            await interaction.response.defer()

        async def on_confirm(self, interaction: discord.Interaction):
            try:
                if self.temp_team1 & self.temp_team2:
                    await interaction.response.send_message(
                        "같은 참가자를 양쪽 팀에 배정할 수 없습니다.",
                        ephemeral=True
                    )
                    return

                if not self.temp_team1 or not self.temp_team2:
                    await interaction.response.send_message(
                        "각 팀에 최소 1명 이상의 참가자를 선택해야 합니다.",
                        ephemeral=True
                    )
                    return

                self.cog.team1 = self.temp_team1
                self.cog.team2 = self.temp_team2
                
                team_announcement = (
                    f"🔵 1팀: {', '.join([f'<@{id}>' for id in self.temp_team1])}\n"
                    f"🔴 2팀: {', '.join([f'<@{id}>' for id in self.temp_team2])}"
                )
                await self.cog.log_to_channel(team_announcement, is_announcement=True)
                
                try:
                    original_message = await interaction.message.channel.fetch_message(
                        interaction.message.reference.message_id
                    )
                    await original_message.edit(
                        embed=self.cog.create_combat_embed(),
                        view=self.cog.CombatView(self.cog)
                    )
                except:
                    await interaction.channel.send(
                        embed=self.cog.create_combat_embed(),
                        view=self.cog.CombatView(self.cog)
                    )
                
                await interaction.message.delete()
                
            except Exception as e:
                logger.error(f"팀 구성 중 오류 발생: {e}")
                await interaction.response.send_message(
                    "팀 구성 중 오류가 발생했습니다.",
                    ephemeral=True
                )

    @commands.command(name="모의전")
    @commands.guild_only()
    async def combat(self, ctx):
        """모의전 시스템 시작"""
        if not self.has_combat_role(ctx.author):
            await ctx.send(self.bot.config['messages']['combat']['no_permission'])
            return
            
        try:
            # 모달 대신 직접 시간 입력 모달을 표시
            modal = self.TimeSetModal(self)
            await ctx.interaction.response.send_modal(modal)
            
        except AttributeError:
            # 일반 명령어로 실행된 경우 바로 임베드 생성
            self.start_time = datetime.now()  # 현재 시간으로 설정
            embed = self.create_combat_embed()
            view = self.CombatView(self)
            await ctx.send(embed=embed, view=view)
            await self.log_to_channel(
                f"{ctx.author.display_name}님이 모의전을 시작했습니다.",
                is_announcement=True
            )
            
        except Exception as e:
            logger.error(f"모의전 명령어 실행 중 오류 발생: {e}")
            await ctx.send(self.bot.config['messages']['error'].format(error=str(e)))

async def setup(bot):
    await bot.add_cog(CombatSystem(bot))