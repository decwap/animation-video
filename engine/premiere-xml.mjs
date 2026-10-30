// The edit pack's Premiere Pro timeline, as Final Cut Pro 7 XML (xmeml), which Premiere imports with
// File > Import: every layer stacked on its own track, every track cut at each scene start and
// named after the scene, and a marker per scene. Not yet tested in Premiere itself.
// Part of animation-video (by Web Asamoah).
import path from 'node:path';
import { FPS, W, H } from './config.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Premiere finds the files only by absolute path; a relative one would make it ask to relink each.
export function fileUrl(absPath) {
  if (!path.isAbsolute(absPath) && !/^[A-Za-z]:[\\/]/.test(absPath)) throw new Error(`not an absolute path: ${absPath}`);
  const p = absPath.replace(/\\/g, '/').replace(/^(?=[A-Za-z]:)/, '/');
  return `file://localhost${encodeURI(p).replace(/#/g, '%23').replace(/\?/g, '%3F')}`;
}

export function premiereXml({ name, duration, scenes, video, audio, fps = FPS, width = W, height = H }) {
  const f = (t) => Math.round(t * fps);
  const total = f(duration);
  const rate = `<rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>`;
  const picture = `<samplecharacteristics>${rate}<width>${width}</width><height>${height}</height><anamorphic>FALSE</anamorphic><pixelaspectratio>square</pixelaspectratio><fielddominance>none</fielddominance></samplecharacteristics>`;
  const sound = '<samplecharacteristics><depth>24</depth><samplerate>48000</samplerate></samplecharacteristics>';
  let clipId = 0;
  let fileId = 0;
  const track = (media, kind) => {
    const id = `file-${++fileId}`;
    const fileMedia = kind === 'video' ? `<video>${picture}</video>` : `<audio>${sound}<channelcount>2</channelcount></audio>`;
    const clips = scenes.map((s, k) => {
      const file = k === 0
        ? `<file id="${id}"><name>${esc(media.name)}</name><pathurl>${esc(fileUrl(media.file))}</pathurl>${rate}<duration>${total}</duration><media>${fileMedia}</media></file>`
        : `<file id="${id}"/>`;
      // premiereChannelType / premiereTrackType: Premiere takes both channels of the stereo stem
      return `          <clipitem id="clipitem-${++clipId}"${kind === 'audio' ? ' premiereChannelType="stereo"' : ''}>
            <name>${esc(`${k + 1} ${s.name}`)}</name>
            <enabled>TRUE</enabled>
            <duration>${total}</duration>
            ${rate}
            <start>${f(s.start)}</start>
            <end>${f(s.end)}</end>
            <in>${f(s.start)}</in>
            <out>${f(s.end)}</out>
            ${kind === 'video' && /\.mov$/i.test(media.file) ? '<alphatype>straight</alphatype>\n            ' : ''}${file}${kind === 'audio' ? '\n            <sourcetrack><mediatype>audio</mediatype><trackindex>1</trackindex></sourcetrack>' : ''}
          </clipitem>`;
    }).join('\n');
    return `        <track${kind === 'audio' ? ' premiereTrackType="Stereo"' : ''}>\n${clips}\n        </track>`;
  };
  const markers = scenes.map((s, k) => `    <marker><name>${esc(`${k + 1} ${s.name}`)}</name><comment></comment><in>${f(s.start)}</in><out>-1</out></marker>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence id="sequence-1">
    <name>${esc(name)}</name>
    <duration>${total}</duration>
    ${rate}
    <timecode>${rate}<string>00:00:00:00</string><frame>0</frame><displayformat>NDF</displayformat></timecode>
    <media>
      <video>
        <format>${picture}</format>
${video.map((v) => track(v, 'video')).join('\n')}
      </video>
      <audio>
        <numOutputChannels>2</numOutputChannels>
        <format>${sound}</format>
${audio.map((a) => track(a, 'audio')).join('\n')}
      </audio>
    </media>
${markers}
  </sequence>
</xmeml>
`;
}
