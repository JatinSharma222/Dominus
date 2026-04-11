import { portfolioTool, executePortfolioRead } from "./portfolio"

export const allTools = {
  get_portfolio: {
    ...portfolioTool,
    execute: executePortfolioRead,
  },
}