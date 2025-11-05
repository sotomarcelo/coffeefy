from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = 'tu-clave-secreta'
DEBUG = True
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'jazzmin',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'api',
]


JAZZMIN_SETTINGS = {
    "site_title": "CoffeFy Admin ☕",
    "site_header": "Panel de Administración CoffeFy",
    "welcome_sign": "Bienvenido al panel de control de CoffeFy",
    "site_brand": "CoffeFy",
    "show_sidebar": True,
    "search_model": ["users.User", "roasteries.Roastery", "rewards.RewardPoint"],
    "order_with_respect_to": ["users", "roasteries", "rewards"],
    "icons": {
        "users.User": "fas fa-user",
        "roasteries.Roastery": "fas fa-store",
        "coffee.CoffeeBean": "fas fa-coffee",
        "rewards.RewardPoint": "fas fa-star",
        "rewards.RewardProgram": "fas fa-gift",
        "rewards.RewardRedemption": "fas fa-trophy",
    },
    "custom_links": {
        "roasteries": [{
            "name": "Ver Mapa",
            "url": "https://maps.google.com",
            "icon": "fas fa-map-marker-alt",
            "permissions": ["auth.view_user"],
        }]
    },
    "show_ui_builder": True,
}


MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

CORS_ALLOW_ALL_ORIGINS = True

ROOT_URLCONF = 'coffeefy.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'coffeefy.wsgi.application'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ]
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'AUTH_HEADER_TYPES': ('Bearer',),
}

AUTH_USER_MODEL = 'api.User'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
        'TEST': {
            'NAME': None,
            'SERIALIZE': False,
        },
    }
}

STATIC_URL = '/static/'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
