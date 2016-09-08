﻿using Mods;
using System;
using System.IO;
using System.Linq;
using System.Xml.Linq;

namespace Installer.Logging.Upgraders
{
	/// <summary>
	/// Upgrades the Install Log to the current version from version 0.3.0.0.
	/// </summary>
	public class Upgrade0300Task : UpgradeTask
	{
		private static readonly Version SUPPORTED_VERSION = new Version("0.3.0.0");

		/// <summary>
		/// Upgrades the install log.
		/// </summary>
		/// <param name="p_mrgModRegistry">The <see cref="ModRegistry"/> that contains the list
		/// of managed mods.</param>
		/// <param name="p_strModInstallDirectory">The path of the directory where all of the mods are installed.</param>
		/// <param name="p_strLogStream">The stream from which to load the install log information.</param>
		protected override void UpgradeInstallLog(Stream p_strLogStream, string p_strModInstallDirectory, IModRegistry p_mrgModRegistry)
		{
			string strModInstallDirectory = p_strModInstallDirectory.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar).Trim(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
			XDocument docLog = XDocument.Load(p_strLogStream);

			string strLogVersion = docLog.Element("installLog").Attribute("fileVersion").Value;
			if (!SUPPORTED_VERSION.ToString().Equals(strLogVersion))
				throw new UpgradeException(String.Format("Cannot upgrade Install Log version: {0} Expecting {1}", strLogVersion, SUPPORTED_VERSION));

			XElement xelModList = docLog.Descendants("modList").FirstOrDefault();
			if (xelModList != null)
			{
				foreach (XElement xelMod in xelModList.Elements("mod"))
				{
					string strModPath = xelMod.Attribute("path").Value;
					if (InstallLog.OriginalValueMod.Filename.Equals(strModPath))
						xelMod.Add(new XElement("name", new XText(InstallLog.OriginalValueMod.ModName)));
					else if (InstallLog.ModManagerValueMod.Filename.Equals(strModPath))
						xelMod.Add(new XElement("name", new XText(InstallLog.ModManagerValueMod.ModName)));
					else
					{
						strModPath = Path.GetFileName(xelMod.Attribute("path").Value);
						IMod modMod = p_mrgModRegistry.RegisteredMods.FirstOrDefault(x => Path.GetFileName(x.Filename).Equals(strModPath, StringComparison.OrdinalIgnoreCase));
						if (modMod != null)
						{
							strModPath = modMod.Filename.Substring(strModInstallDirectory.Length);
							xelMod.Attribute("path").Value = strModPath;
							xelMod.Add(new XElement("name",
													new XText(modMod.ModName)));
						}
						else
							xelMod.Add(new XElement("name", new XText("MISSING MOD")));
					}
				}
			}

			docLog.Element("installLog").Attribute("fileVersion").Value = InstallLog.CurrentVersion.ToString();

			p_strLogStream.SetLength(0);
			docLog.Save(p_strLogStream);
		}
	}
}
