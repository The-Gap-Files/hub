<template>
  <div class="oled-theme">
    <NuxtLoadingIndicator color="#FA5401" />
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
