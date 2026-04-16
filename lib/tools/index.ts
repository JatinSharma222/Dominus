import { portfolioTool, executePortfolioRead } from "./portfolio"
import { jupiterSwapTool, executeJupiterSwap } from "./jupiter"
import { kaminoDepositTool, executeKaminoDeposit } from "./kamino"

export const allTools = {
  get_portfolio: {
    ...portfolioTool,
    execute: executePortfolioRead,
  },
  swap_tokens: {
    ...jupiterSwapTool,
    execute: executeJupiterSwap,
  },
  deposit_for_yield: {
    ...kaminoDepositTool,
    execute: executeKaminoDeposit,
  },
}