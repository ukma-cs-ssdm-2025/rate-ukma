from rateukma.ioc.decorators import once

from ..auth.microsoft_account_adapters import (
    MicrosoftAccountAdapter,
    MicrosoftSocialAccountAdapter,
)


@once
def microsoft_social_account_adapter(
    request, *args, **kwargs
) -> MicrosoftSocialAccountAdapter:
    # * This adapter is used by Allauth Library, therefore we need to pass the request argument
    # * It is not the common pattern in IoC and should not be reused
    return MicrosoftSocialAccountAdapter(allowed_domains=["ukma.edu.ua"])


@once
def microsoft_account_adapter(request, *args, **kwargs) -> MicrosoftAccountAdapter:
    # * This adapter is used by Allauth Library, therefore we need to pass the request argument
    # * It is non the common pattern in IoC and should not be reused
    return MicrosoftAccountAdapter()
