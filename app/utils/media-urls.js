"use strict";
/**
 * Helper para gerar URLs de mídia do banco de dados
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSceneImageUrl = getSceneImageUrl;
exports.getSceneVideoUrl = getSceneVideoUrl;
exports.getVideoAudioUrl = getVideoAudioUrl;
exports.getVideoDownloadUrl = getVideoDownloadUrl;
function getSceneImageUrl(sceneId) {
    return "/api/scenes/".concat(sceneId, "/image");
}
function getSceneVideoUrl(sceneId) {
    return "/api/scenes/".concat(sceneId, "/video");
}
function getVideoAudioUrl(videoId) {
    return "/api/videos/".concat(videoId, "/audio");
}
function getVideoDownloadUrl(videoId) {
    return "/api/videos/".concat(videoId, "/download");
}
