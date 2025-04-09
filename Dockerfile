# Use Node.js 20 as the base image
FROM node:20-slim

# Install required dependencies for Puppeteer and fonts
RUN apt-get update \
    && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    fonts-noto \
    fonts-noto-cjk \
    fonts-liberation \
    libxss1 \
    unzip \
    curl \
    ca-certificates \
    fontconfig \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Create font directories
RUN mkdir -p /usr/share/fonts/apple /root/.fonts /root/.config/fontconfig

# Download and install SF Pro fonts
RUN curl -L https://github.com/sahibjotsaggu/San-Francisco-Pro-Fonts/archive/refs/heads/master.zip -o sf-pro.zip \
    && unzip sf-pro.zip \
    && cp San-Francisco-Pro-Fonts-master/SF-Pro-* /usr/share/fonts/apple/ \
    && rm -rf San-Francisco-Pro-Fonts-master sf-pro.zip

# Download and install Noto Color Emoji
RUN curl -L https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoColorEmoji.ttf -o /root/.fonts/NotoColorEmoji.ttf

# Create fontconfig
RUN echo '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n\
<match>\n\
 <test name="family"><string>system-ui</string></test>\n\
 <edit name="family" mode="prepend" binding="strong">\n\
 <string>SF Pro</string>\n\
 </edit>\n\
</match>\n\
\n\
<match>\n\
 <test name="family"><string>sans-serif</string></test>\n\
 <edit name="family" mode="prepend" binding="strong">\n\
 <string>Noto Color Emoji</string>\n\
 </edit>\n\
</match>\n\
\n\
<match>\n\
 <test name="family"><string>serif</string></test>\n\
 <edit name="family" mode="prepend" binding="strong">\n\
 <string>Noto Color Emoji</string>\n\
 </edit>\n\
</match>\n\
\n\
<match>\n\
 <test name="family"><string>Apple Color Emoji</string></test>\n\
 <edit name="family" mode="prepend" binding="strong">\n\
 <string>Noto Color Emoji</string>\n\
 </edit>\n\
</match>' > /root/.config/fontconfig/fonts.conf

# Update font cache
RUN fc-cache -f -v

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.5.1 --activate

# Create app directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Expose the port the app runs on
EXPOSE 3000

# Set NODE_OPTIONS to increase memory limit
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Start the application directly with tsx
CMD ["pnpm", "exec", "tsx", "src/server.ts"]
