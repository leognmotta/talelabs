import type { GenerationModelLogoId } from '@talelabs/flows'

import alibabaLogo from '@lobehub/icons-static-svg/icons/alibaba-color.svg'
import byteDanceLogo from '@lobehub/icons-static-svg/icons/bytedance-color.svg'
import claudeLogo from '@lobehub/icons-static-svg/icons/claude-color.svg'
import deepSeekLogo from '@lobehub/icons-static-svg/icons/deepseek-color.svg'
import elevenLabsLogo from '@lobehub/icons-static-svg/icons/elevenlabs.svg'
import fluxLogo from '@lobehub/icons-static-svg/icons/flux.svg'
import geminiLogo from '@lobehub/icons-static-svg/icons/gemini-color.svg'
import googleLogo from '@lobehub/icons-static-svg/icons/google-color.svg'
import klingLogo from '@lobehub/icons-static-svg/icons/kling-color.svg'
import lightricksLogo from '@lobehub/icons-static-svg/icons/lightricks.svg'
import microsoftLogo from '@lobehub/icons-static-svg/icons/microsoft-color.svg'
import minimaxLogo from '@lobehub/icons-static-svg/icons/minimax-color.svg'
import mistralLogo from '@lobehub/icons-static-svg/icons/mistral-color.svg'
import moonshotLogo from '@lobehub/icons-static-svg/icons/moonshot.svg'
import nanoBananaLogo from '@lobehub/icons-static-svg/icons/nanobanana-color.svg'
import openAiLogo from '@lobehub/icons-static-svg/icons/openai.svg'
import qwenLogo from '@lobehub/icons-static-svg/icons/qwen-color.svg'
import recraftLogo from '@lobehub/icons-static-svg/icons/recraft.svg'
import stabilityLogo from '@lobehub/icons-static-svg/icons/stability.svg'
import xAiLogo from '@lobehub/icons-static-svg/icons/xai.svg'
import zaiLogo from '@lobehub/icons-static-svg/icons/zai.svg'
import { IconSparkles } from '@tabler/icons-react'
import { cn } from '@talelabs/ui/lib/utils'

const MODEL_LOGOS = {
  alibaba: { monochrome: false, src: alibabaLogo },
  bytedance: { monochrome: false, src: byteDanceLogo },
  claude: { monochrome: false, src: claudeLogo },
  deepseek: { monochrome: false, src: deepSeekLogo },
  elevenlabs: { monochrome: true, src: elevenLabsLogo },
  flux: { monochrome: true, src: fluxLogo },
  gemini: { monochrome: false, src: geminiLogo },
  google: { monochrome: false, src: googleLogo },
  kling: { monochrome: false, src: klingLogo },
  lightricks: { monochrome: true, src: lightricksLogo },
  microsoft: { monochrome: false, src: microsoftLogo },
  minimax: { monochrome: false, src: minimaxLogo },
  mistral: { monochrome: false, src: mistralLogo },
  moonshot: { monochrome: true, src: moonshotLogo },
  nanobanana: { monochrome: false, src: nanoBananaLogo },
  openai: { monochrome: true, src: openAiLogo },
  qwen: { monochrome: false, src: qwenLogo },
  recraft: { monochrome: true, src: recraftLogo },
  stability: { monochrome: true, src: stabilityLogo },
  xai: { monochrome: true, src: xAiLogo },
  zai: { monochrome: true, src: zaiLogo },
} as const satisfies Record<
  Exclude<GenerationModelLogoId, 'llm'>,
  {
    monochrome: boolean
    src: string
  }
>

export function ModelLogo({
  className,
  logoId,
}: {
  className?: string
  logoId: GenerationModelLogoId
}) {
  if (logoId === 'llm') {
    return (
      <span
        aria-hidden
        className={cn(
          `
            flex size-9 shrink-0 items-center justify-center rounded-xl border
            border-border/70 bg-background/75 text-foreground shadow-xs
          `,
          className,
        )}
      >
        <IconSparkles className="size-5" />
      </span>
    )
  }
  const logo = MODEL_LOGOS[logoId]

  return (
    <span
      aria-hidden
      className={cn(
        `
          flex size-9 shrink-0 items-center justify-center rounded-xl border
          border-border/70 bg-background/75 shadow-xs
        `,
        className,
      )}
    >
      <img
        alt=""
        className={cn(
          'size-5 object-contain',
          logo.monochrome && 'dark:invert',
        )}
        src={logo.src}
      />
    </span>
  )
}
