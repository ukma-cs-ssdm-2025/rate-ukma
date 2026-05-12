import re

_BOT_UA_RE = re.compile(
    r"facebookexternalhit|Twitterbot|TelegramBot|Discordbot|LinkedInBot"
    r"|Slackbot|WhatsApp|vkShare|redditbot|applebot|bingbot|Googlebot",
    re.IGNORECASE,
)


def is_social_bot(user_agent: str) -> bool:
    return bool(_BOT_UA_RE.search(user_agent))
