<template>
  <div class="oled-theme">
    <NuxtLoadingIndicator color="var(--primary)" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <NotificationToast />
  </div>
</template>

<style>
@import "~/assets/css/main.css";

/* Reset background para garantir OLED black */
body {
  background-color: #0A0A0F;
}
</style>
