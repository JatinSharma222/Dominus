import { portfolioTool, executePortfolioRead } from "./portfolio"
import { jupiterSwapTool, executeJupiterSwap } from "./jupiter"

export const allTools = {
  get_portfolio: {
    ...portfolioTool,
    execute: executePortfolioRead,
  },
  swap_tokens: {
    ...jupiterSwapTool,
    execute: executeJupiterSwap,
  },
}